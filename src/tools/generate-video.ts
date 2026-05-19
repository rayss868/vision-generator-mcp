import type { VisionService } from '../core/vision-service.js';
import { GenerateVideoSchema } from '../validation/video.js';

export async function runGenerateVideoTool(visionService: VisionService, rawArgs: unknown) {
  const args = GenerateVideoSchema.parse(rawArgs);
  const result = await visionService.generateVideo(args);
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
  };
}
