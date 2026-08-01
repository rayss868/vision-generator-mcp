import axios, { type AxiosInstance } from 'axios';
import FormData from 'form-data';
import { promises as fs } from 'fs';
import path from 'path';
import type {
  AnimateImageInput,
  EditImageInput,
  GenerateImageInput,
  GenerateVideoInput,
} from '../types/contracts.js';
import type {
  OutputDimensions,
  ProviderAdapter,
  ProviderImageResult,
  ProviderModelInfo,
  ProviderVideoStatusResult,
  ProviderVideoSubmitResult,
} from './base-provider.js';
import { coerceMimeType, detectMimeType } from '../utils/mime.js';

export interface OpenAICompatibleAdapterConfig {
  baseUrl: string;
  apiKey: string;
  providerTimeoutMs: number;
  downloadTimeoutMs: number;
}

export class OpenAICompatibleAdapter implements ProviderAdapter {
  private readonly http: AxiosInstance;

  constructor(private readonly config: OpenAICompatibleAdapterConfig) {
    this.http = axios.create({
      baseURL: config.baseUrl.replace(/\/$/, ''),
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
      },
      timeout: config.providerTimeoutMs,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });
  }

  async listModels(): Promise<ProviderModelInfo[]> {
    const response = await this.http.get('/models');
    const data = response.data as { data?: ProviderModelInfo[] };
    return Array.isArray(data.data) ? data.data : [];
  }

  async generateImage(input: GenerateImageInput): Promise<ProviderImageResult> {
    const payload: Record<string, unknown> = {
      model: input.model,
      prompt: input.prompt,
      response_format: 'b64_json',
    };

    if (input.negative_prompt) payload.negative_prompt = input.negative_prompt;
    if (input.reference_text) payload.reference_text = input.reference_text;
    if (input.reference_images) payload.reference_images = input.reference_images;
    if (input.aspect_ratio) payload.aspect_ratio = input.aspect_ratio;
    if (input.resolution) payload.size = input.resolution;
    if (input.seed !== undefined) payload.seed = input.seed;
    if (input.style) payload.style = input.style;
    if (input.safety_level) payload.safety_level = input.safety_level;

    const response = await this.http.post('/images/generations', payload);
    const data = response.data as {
      data?: Array<{ b64_json?: string; revised_prompt?: string; url?: string }>;
    };
    const first = data.data?.[0];

    if (!first) {
      throw new Error('Provider returned no image output.');
    }

    const bytes = await this.resolveBinaryOutput(first);
    return {
      bytes,
      mimeType: detectMimeType(bytes, 'image/png'),
      capability: buildDimensions(input.resolution),
      raw: response.data,
    };
  }

  async editImage(input: EditImageInput): Promise<ProviderImageResult> {
    const form = new FormData();
    form.append('model', input.model);
    form.append('prompt', input.prompt);
    form.append('response_format', 'b64_json');

    if (input.negative_prompt) form.append('negative_prompt', input.negative_prompt);
    if (input.reference_text) form.append('reference_text', input.reference_text);
    if (input.reference_images) {
      for (const referencePath of input.reference_images) {
        form.append('reference_images', await fs.readFile(referencePath), {
          filename: path.basename(referencePath),
          contentType: coerceMimeType(referencePath),
        });
      }
    }
    if (input.aspect_ratio) form.append('aspect_ratio', input.aspect_ratio);
    if (input.resolution) form.append('size', input.resolution);
    if (input.seed !== undefined) form.append('seed', String(input.seed));
    if (input.style) form.append('style', input.style);
    if (input.safety_level) form.append('safety_level', input.safety_level);

    form.append('image', await fs.readFile(input.image_path), {
      filename: path.basename(input.image_path),
      contentType: coerceMimeType(input.image_path),
    });

    if (input.mask_path) {
      form.append('mask', await fs.readFile(input.mask_path), {
        filename: path.basename(input.mask_path),
        contentType: coerceMimeType(input.mask_path),
      });
    }

    const response = await this.http.post('/images/edits', form, {
      headers: form.getHeaders(),
    });

    const data = response.data as {
      data?: Array<{ b64_json?: string; url?: string }>;
    };
    const first = data.data?.[0];

    if (!first) {
      throw new Error('Provider returned no edited image output.');
    }

    const bytes = await this.resolveBinaryOutput(first);
    return {
      bytes,
      mimeType: detectMimeType(bytes, 'image/png'),
      capability: buildDimensions(input.resolution),
      raw: response.data,
    };
  }

  async generateVideo(input: GenerateVideoInput | AnimateImageInput): Promise<ProviderVideoSubmitResult> {
    const payload: Record<string, unknown> = {
      model: input.model,
      prompt: input.prompt,
    };

    if (input.negative_prompt) payload.negative_prompt = input.negative_prompt;
    if (input.reference_text) payload.reference_text = input.reference_text;
    if (input.reference_images) {
      payload.reference_images = await Promise.all(
        input.reference_images.map(async (referencePath) =>
          (await fs.readFile(referencePath)).toString('base64')
        )
      );
    }
    if (input.duration_seconds !== undefined) payload.duration_seconds = input.duration_seconds;
    if (input.fps !== undefined) payload.fps = input.fps;
    if (input.aspect_ratio) payload.aspect_ratio = input.aspect_ratio;
    if (input.resolution) payload.resolution = input.resolution;
    if (input.seed !== undefined) payload.seed = input.seed;
    if (input.style) payload.style = input.style;
    if (input.safety_level) payload.safety_level = input.safety_level;

    if ('image_path' in input) {
      payload.image = (await fs.readFile(input.image_path)).toString('base64');
    }

    const response = await this.http.post('/videos/generations', payload);
    const providerJobId = extractProviderJobId(response.data);

    if (!providerJobId) {
      throw new Error('Provider did not return a video job id.');
    }

    return {
      providerJobId,
      raw: response.data,
    };
  }

  async getVideoJobStatus(providerJobId: string): Promise<ProviderVideoStatusResult> {
    const response = await this.http.get(`/videos/generations/${providerJobId}`);
    const raw = response.data as Record<string, unknown>;
    const status = normalizeProviderStatus(String(raw.status ?? raw.state ?? 'running'));
    const downloadUrl =
      getString(raw.url) ??
      getString(raw.download_url) ??
      getString(raw.video_url) ??
      getString((raw.output as Record<string, unknown> | undefined)?.url);

    return {
      status,
      downloadUrl,
      mimeType: getString(raw.mime_type) ?? 'video/mp4',
      width: getNumber(raw.width),
      height: getNumber(raw.height),
      durationSeconds: getNumber(raw.duration_seconds) ?? getNumber(raw.duration),
      fps: getNumber(raw.fps),
      raw,
    };
  }

  async downloadBinary(url: string): Promise<Buffer> {
    const response = await axios.get<ArrayBuffer>(url, {
      responseType: 'arraybuffer',
      timeout: this.config.downloadTimeoutMs,
    });
    return Buffer.from(response.data);
  }

  private async resolveBinaryOutput(item: { b64_json?: string; url?: string }): Promise<Buffer> {
    if (item.b64_json) {
      return Buffer.from(item.b64_json, 'base64');
    }

    if (item.url) {
      return this.downloadBinary(item.url);
    }

    throw new Error('Provider image output did not contain b64_json or url.');
  }
}

function buildDimensions(resolution: string | undefined): OutputDimensions {
  return {
    width: tryExtractDimension(resolution, 0),
    height: tryExtractDimension(resolution, 1),
  };
}

function tryExtractDimension(resolution: string | undefined, index: 0 | 1): number | undefined {
  if (!resolution) return undefined;
  const parts = resolution.toLowerCase().split('x').map((value) => Number(value.trim()));
  const value = parts[index];
  return Number.isFinite(value) ? value : undefined;
}

function extractProviderJobId(raw: unknown): string | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const object = raw as Record<string, unknown>;
  return getString(object.id) ?? getString(object.job_id) ?? getString(object.task_id) ?? getString(object.request_id);
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function getNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function normalizeProviderStatus(status: string): ProviderVideoStatusResult['status'] {
  const normalized = status.toLowerCase();
  if (['succeeded', 'success', 'completed', 'done', 'finished'].includes(normalized)) return 'succeeded';
  if (['failed', 'error', 'cancelled', 'canceled'].includes(normalized)) return normalized === 'failed' || normalized === 'error' ? 'failed' : 'cancelled';
  if (['queued', 'pending'].includes(normalized)) return 'queued';
  return 'running';
}
