import type { VisionService } from '../core/vision-service.js';
import { GenerateImageSchema } from '../validation/image.js';

export async function runGenerateImageTool(visionService: VisionService, rawArgs: unknown) {
  const args = GenerateImageSchema.parse(rawArgs);
  const result = await visionService.generateImage(args);
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
  };
}
