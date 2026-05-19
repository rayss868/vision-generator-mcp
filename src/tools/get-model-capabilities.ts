import type { VisionService } from '../core/vision-service.js';
import { GetModelCapabilitiesSchema } from '../validation/job.js';

export async function runGetModelCapabilitiesTool(visionService: VisionService, rawArgs: unknown) {
  const args = GetModelCapabilitiesSchema.parse(rawArgs);
  const result = await visionService.getModelCapabilities(args.model);
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
  };
}
