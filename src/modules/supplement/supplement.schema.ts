import { z } from 'zod';

export const supplementBodySchema = z.object({
  date:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data non valida'),
  time:     z.string().optional(),
  kind:     z.enum(['farmaco', 'integratore']),
  name:     z.string().min(1),
  quantity: z.number().positive(),
  unit:     z.enum(['mg', 'ml', 'g']),
  kcal:     z.number().min(0).optional(),
});

export const idParamSchema = z.object({ id: z.string().min(1) });

export type SupplementBody = z.infer<typeof supplementBodySchema>;
