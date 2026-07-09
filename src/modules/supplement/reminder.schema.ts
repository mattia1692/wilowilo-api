import { z } from 'zod';

export const reminderBodySchema = z.object({
  name:      z.string().min(1),
  dosage:    z.number().positive(),
  unit:      z.string().min(1),
  kind:      z.enum(['farmaco', 'integratore']).default('integratore'),
  note:      z.string().optional().nullable(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  isActive:  z.boolean().default(true),
});

export const reminderPatchSchema = reminderBodySchema.partial();

export const idParamSchema = z.object({ id: z.string().min(1) });

export type ReminderBody = z.infer<typeof reminderBodySchema>;
export type ReminderPatch = z.infer<typeof reminderPatchSchema>;
