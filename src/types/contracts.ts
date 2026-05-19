export type VisionOperation =
  | 'image_generation'
  | 'image_editing'
  | 'image_variation'
  | 'text_to_video'
  | 'image_to_video';

export type ToolStatus = 'queued' | 'submitted' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export interface OutputTarget {
  directory: string;
  filename_prefix?: string;
  overwrite?: boolean;
  create_directory?: boolean;
}

export interface GenerateImageInput {
  model: string;
  prompt: string;
  negative_prompt?: string;
  aspect_ratio?: '1:1' | '4:5' | '16:9' | '9:16';
  resolution?: string;
  seed?: number;
  style?: string;
  safety_level?: 'low' | 'medium' | 'high';
  output: OutputTarget;
}

export interface EditImageInput extends GenerateImageInput {
  image_path: string;
  mask_path?: string;
}

export interface GenerateVideoInput {
  model: string;
  prompt: string;
  negative_prompt?: string;
  duration_seconds?: number;
  fps?: number;
  aspect_ratio?: '1:1' | '4:5' | '16:9' | '9:16';
  resolution?: string;
  seed?: number;
  style?: string;
  safety_level?: 'low' | 'medium' | 'high';
  output: OutputTarget;
}

export interface AnimateImageInput extends GenerateVideoInput {
  image_path: string;
}

export interface VisionModelCapability {
  id: string;
  operations: Record<VisionOperation, boolean>;
  width?: number;
  height?: number;
}

export interface ToolOutput {
  type: 'image' | 'video';
  mime_type: string;
  final_path?: string;
  download_url?: string;
  width?: number;
  height?: number;
  duration_seconds?: number;
  fps?: number;
}

export interface ToolResult {
  status: ToolStatus;
  provider: string;
  model: string;
  operation: VisionOperation;
  outputs: ToolOutput[];
  job_id?: string;
  provider_job_id?: string;
}
