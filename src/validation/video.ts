import { z } from 'zod';
import { AspectRatioSchema, SafetyLevelSchema } from './common.js';
import { OutputSchema } from './output.js';

export const GenerateVideoSchema = z.object({
  model: z.string().min(1),
  prompt: z.string().min(1).max(5000),
  negative_prompt: z.string().max(5000).optional(),
  duration_seconds: z.number().min(1).max(60).optional(),
  fps: z.number().int().min(1).max(60).optional(),
  aspect_ratio: AspectRatioSchema.optional(),
  resolution: z.string().optional(),
  seed: z.number().int().nonnegative().optional(),
  style: z.string().optional(),
  safety_level: SafetyLevelSchema.optional(),
  output: OutputSchema,
});

export const AnimateImageSchema = GenerateVideoSchema.extend({
  image_path: z.string().min(1),
});
