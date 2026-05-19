import type {
  AnimateImageInput,
  EditImageInput,
  GenerateImageInput,
  GenerateVideoInput,
  ToolResult,
} from '../types/contracts.js';

export interface ProviderModelInfo {
  id: string;
  object?: string;
  owned_by?: string;
  modalities?: string[];
  input_modalities?: string[];
  output_modalities?: string[];
  type?: string;
  capabilities?: Record<string, unknown>;
}

export interface OutputDimensions {
  width?: number;
  height?: number;
}

export interface ProviderImageResult {
  bytes: Buffer;
  mimeType: string;
  capability: OutputDimensions;
  raw: unknown;
}

export interface ProviderVideoSubmitResult {
  providerJobId: string;
  raw: unknown;
}

export interface ProviderVideoStatusResult {
  status: ToolResult['status'];
  downloadUrl?: string;
  mimeType?: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
  fps?: number;
  raw: unknown;
}

export interface ProviderAdapter {
  listModels(): Promise<ProviderModelInfo[]>;
  generateImage(input: GenerateImageInput): Promise<ProviderImageResult>;
  editImage(input: EditImageInput): Promise<ProviderImageResult>;
  generateVideo(input: GenerateVideoInput | AnimateImageInput): Promise<ProviderVideoSubmitResult>;
  getVideoJobStatus(providerJobId: string): Promise<ProviderVideoStatusResult>;
  downloadBinary(url: string): Promise<Buffer>;
}
