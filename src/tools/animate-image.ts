import type { VisionService } from '../core/vision-service.js';
import { AnimateImageSchema } from '../validation/video.js';

export async function runAnimateImageTool(visionService: VisionService, rawArgs: unknown) {
  const args = AnimateImageSchema.parse(rawArgs);
  const result = await visionService.animateImage(args);
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
  };
}
