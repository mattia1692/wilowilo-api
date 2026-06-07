import { z } from 'zod';

const MEASUREMENT_TYPES = [
  'vita', 'fianchi', 'petto', 'bicipite', 'coscia', 'collo', 'spalle', 'polpaccio',
  'grasso_corp', 'massa_musc', 'idratazione',
  'freq_riposo', 'pressione_sis', 'pressione_dia',
] as const;

const UNITS = ['cm', '%', 'bpm', 'mmHg', 'kg'] as const;

export const measurementBodySchema = z.object({
  date:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data non valida'),
  type:  z.enum(MEASUREMENT_TYPES),
  value: z.number(),
  unit:  z.enum(UNITS),
  note:  z.string().optional(),
});

export const idParamSchema = z.object({ id: z.string().min(1) });

export type MeasurementBody = z.infer<typeof measurementBodySchema>;
