import { z } from 'zod';

export const activityBodySchema = z.object({
  date:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data non valida'),
  time:        z.string().optional(),
  type:        z.string().min(1),
  name:        z.string().min(1),
  icon:        z.string().min(1),
  color:       z.string().min(1),
  duration:    z.number().int().min(1),
  intensity:   z.enum(['leggera', 'media', 'intensa']),
  distance:    z.number().optional(),
  kcal:        z.number().int().min(0),
  addToBudget: z.boolean().default(false),
});

export const idParamSchema = z.object({ id: z.string().min(1) });

export type ActivityBody = z.infer<typeof activityBodySchema>;
