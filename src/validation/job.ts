import { z } from 'zod';

export const GetModelCapabilitiesSchema = z.object({
  model: z.string().min(1),
});

export const GetJobStatusSchema = z.object({
  job_id: z.string().min(1),
});
