import { z } from 'zod';

export const OutputSchema = z.object({
  directory: z.string().min(1),
  filename_prefix: z.string().min(1).optional(),
  overwrite: z.boolean().optional(),
  create_directory: z.boolean().optional(),
});
