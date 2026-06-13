import axios, { AxiosError } from 'axios';
import type { ProviderConfig } from '../config/providers.js';
import { publishOutput } from './file-output-publisher.js';
import { buildVisionModelRegistry } from './model-discovery.js';
import { createProviderAdapter } from '../providers/provider-factory.js';
import type {
  AnimateImageInput,
  EditImageInput,
  GenerateImageInput,
  GenerateVideoInput,
  OutputTarget,
  ToolResult,
  VisionModelCapability,
  VisionOperation,
} from '../types/contracts.js';
import type { ProviderAdapter } from '../providers/base-provider.js';

interface ProviderJobRecord {
  localJobId: string;
  providerJobId: string;
  operation: VisionOperation;
  model: string;
  output: OutputTarget;
}

export class VisionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable = false,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'VisionError';
  }
}

export function createVisionService(config: ProviderConfig) {
  return new VisionService(config);
}

export class VisionService {
  private readonly adapter: ProviderAdapter;
  private discoveredModels: VisionModelCapability[] | null = null;
  private readonly jobs = new Map<string, ProviderJobRecord>();

  constructor(private readonly config: ProviderConfig) {
    this.adapter = createProviderAdapter(config);
  }

  async listModels(): Promise<{ provider: string; models: VisionModelCapability[] }> {
    const models = await this.getDiscoveredModels();
    return {
      provider: this.config.baseUrl,
      models,
    };
  }

  async getModelCapabilities(model: string): Promise<VisionModelCapability> {
    const models = await this.getDiscoveredModels();
    const found = models.find((item) => item.id === model);
    if (!found) {
      throw new VisionError(`Model ${model} was not found in discovered image/video models.`, 'MODEL_NOT_FOUND');
    }
    return found;
  }

  async generateImage(input: GenerateImageInput): Promise<ToolResult> {
    const capability = await this.requireOperation(input.model, 'image_generation');
    const generated = await this.adapter.generateImage(input);
    const published = await publishOutput(generated.bytes, input.output, '.png');
    return {
      status: 'succeeded',
      provider: this.config.baseUrl,
      model: input.model,
      operation: 'image_generation',
      outputs: [
        {
          type: 'image',
          mime_type: published.mimeType,
          final_path: published.finalPath,
          base64_data: generated.bytes.toString('base64'),
          width: generated.capability.width ?? capability.width,
          height: generated.capability.height ?? capability.height,
        },
      ],
    };
  }

  async editImage(input: EditImageInput): Promise<ToolResult> {
    const capability = await this.requireOperation(input.model, 'image_editing');
    const edited = await this.adapter.editImage(input);
    const published = await publishOutput(edited.bytes, input.output, '.png');
    return {
      status: 'succeeded',
      provider: this.config.baseUrl,
      model: input.model,
      operation: 'image_editing',
      outputs: [
        {
          type: 'image',
          mime_type: published.mimeType,
          final_path: published.finalPath,
          base64_data: edited.bytes.toString('base64'),
          width: edited.capability.width ?? capability.width,
          height: edited.capability.height ?? capability.height,
        },
      ],
    };
  }

  async generateVideo(input: GenerateVideoInput): Promise<ToolResult> {
    await this.requireOperation(input.model, 'text_to_video');
    const submitted = await this.adapter.generateVideo(input);
    const jobId = createLocalJobId('video');
    this.jobs.set(jobId, {
      localJobId: jobId,
      providerJobId: submitted.providerJobId,
      operation: 'text_to_video',
      model: input.model,
      output: input.output,
    });

    return {
      status: 'submitted',
      provider: this.config.baseUrl,
      model: input.model,
      operation: 'text_to_video',
      job_id: jobId,
      provider_job_id: submitted.providerJobId,
      outputs: [],
    };
  }

  async animateImage(input: AnimateImageInput): Promise<ToolResult> {
    await this.requireOperation(input.model, 'image_to_video');
    const submitted = await this.adapter.generateVideo(input);
    const jobId = createLocalJobId('video');
    this.jobs.set(jobId, {
      localJobId: jobId,
      providerJobId: submitted.providerJobId,
      operation: 'image_to_video',
      model: input.model,
      output: input.output,
    });

    return {
      status: 'submitted',
      provider: this.config.baseUrl,
      model: input.model,
      operation: 'image_to_video',
      job_id: jobId,
      provider_job_id: submitted.providerJobId,
      outputs: [],
    };
  }

  async getJobStatus(jobId: string): Promise<ToolResult> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new VisionError(`Job ${jobId} was not found.`, 'JOB_NOT_FOUND');
    }

    const status = await this.adapter.getVideoJobStatus(job.providerJobId);
    if (status.status !== 'succeeded') {
      return {
        status: status.status,
        provider: this.config.baseUrl,
        model: job.model,
        operation: job.operation,
        job_id: job.localJobId,
        provider_job_id: job.providerJobId,
        outputs: [],
      };
    }

    if (!status.downloadUrl) {
      throw new VisionError(
        'Video job succeeded but provider did not return a final download URL.',
        'VIDEO_DOWNLOAD_URL_MISSING'
      );
    }

    const bytes = await this.adapter.downloadBinary(status.downloadUrl);
    const published = await publishOutput(bytes, job.output, '.mp4');
    this.jobs.delete(jobId);
    return {
      status: 'succeeded',
      provider: this.config.baseUrl,
      model: job.model,
      operation: job.operation,
      job_id: job.localJobId,
      provider_job_id: job.providerJobId,
      outputs: [
        {
          type: 'video',
          mime_type: published.mimeType,
          final_path: published.finalPath,
          width: status.width,
          height: status.height,
          duration_seconds: status.durationSeconds,
          fps: status.fps,
        },
      ],
    };
  }

  private async getDiscoveredModels(): Promise<VisionModelCapability[]> {
    if (this.discoveredModels) {
      return this.discoveredModels;
    }

    const providerModels = await this.adapter.listModels();
    this.discoveredModels = buildVisionModelRegistry(providerModels);
    return this.discoveredModels;
  }

  private async requireOperation(modelId: string, operation: VisionOperation): Promise<VisionModelCapability> {
    const capability = await this.getModelCapabilities(modelId);
    if (!capability.operations[operation]) {
      throw new VisionError(
        `Model ${modelId} does not support ${operation}.`,
        'MODEL_CAPABILITY_UNSUPPORTED',
        false,
        {
          requested_operation: operation,
          supported_operations: Object.entries(capability.operations)
            .filter((entry) => entry[1])
            .map((entry) => entry[0]),
        }
      );
    }

    return capability;
  }
}

function createLocalJobId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeUnknownError(error: unknown): VisionError {
  if (error instanceof VisionError) return error;
  if (axios.isAxiosError(error)) {
    return normalizeAxiosError(error);
  }
  if (error instanceof Error) {
    return new VisionError(error.message, 'UNEXPECTED_ERROR');
  }
  return new VisionError('Unknown error occurred.', 'UNEXPECTED_ERROR');
}

function normalizeAxiosError(error: AxiosError): VisionError {
  const providerMessage = extractAxiosMessage(error);
  const status = error.response?.status;
  const retryable = status !== undefined ? status >= 500 || status === 429 : true;
  return new VisionError(providerMessage, 'PROVIDER_HTTP_ERROR', retryable, {
    status,
    response: error.response?.data,
  });
}

function extractAxiosMessage(error: AxiosError): string {
  const data = error.response?.data;
  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>;
    const direct = getString(record.message);
    if (direct) return direct;
    if (record.error && typeof record.error === 'object') {
      const nested = getString((record.error as Record<string, unknown>).message);
      if (nested) return nested;
    }
  }
  return error.message;
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
