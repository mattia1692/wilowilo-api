import { z } from 'zod';

export const weightBodySchema = z.object({
  weight: z.number().positive(),
  note: z.string().optional(),
});

export const checkpointBodySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  targetWeight: z.number().positive(),
  label: z.string().optional(),
  benefits: z.array(z.string()).optional(),
});

export const checkpointPatchSchema = checkpointBodySchema.partial();

export const dateParamSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const idParamSchema = z.object({
  id: z.string().min(1),
});

export type WeightBody = z.infer<typeof weightBodySchema>;
export type CheckpointBody = z.infer<typeof checkpointBodySchema>;
export type CheckpointPatch = z.infer<typeof checkpointPatchSchema>;
