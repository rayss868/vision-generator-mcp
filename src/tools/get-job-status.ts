import type { VisionService } from '../core/vision-service.js';
import { GetJobStatusSchema } from '../validation/job.js';

export async function runGetJobStatusTool(visionService: VisionService, rawArgs: unknown) {
  const args = GetJobStatusSchema.parse(rawArgs);
  const result = await visionService.getJobStatus(args.job_id);
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
  };
}
