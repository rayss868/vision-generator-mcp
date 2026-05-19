import { z } from 'zod';

export const AspectRatioSchema = z.enum(['1:1', '4:5', '16:9', '9:16']);
export const SafetyLevelSchema = z.enum(['low', 'medium', 'high']);
