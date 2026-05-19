import type { VisionService } from '../core/vision-service.js';

export async function runListModelsTool(visionService: VisionService) {
  const result = await visionService.listModels();
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
  };
}
