import type { VisionService } from '../core/vision-service.js';
import { EditImageSchema } from '../validation/image.js';

export async function runEditImageTool(visionService: VisionService, rawArgs: unknown) {
  const args = EditImageSchema.parse(rawArgs);
  const result = await visionService.editImage(args);
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
  };
}
