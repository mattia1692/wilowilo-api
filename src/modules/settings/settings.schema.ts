import { z } from 'zod';

export const settingsPatchSchema = z.object({
  kcal: z.number().min(0).optional(),
  protein: z.number().min(0).optional(),
  carbs: z.number().min(0).optional(),
  fat: z.number().min(0).optional(),
  satfat: z.number().min(0).optional(),
  fiber: z.number().min(0).optional(),
  waterTarget: z.number().int().min(0).optional(),
  meals: z.array(z.string()).optional(),
  mealTimes: z.record(z.string()).optional(),
  sheetsUrl: z.string().optional(),
  lang: z.string().optional(),
  weightHidden: z.boolean().optional(),
  wizardCompleted: z.boolean().optional(),
  startWeight: z.number().positive().nullable().optional(),
  goalWeight: z.number().positive().nullable().optional(),
});

export type SettingsPatch = z.infer<typeof settingsPatchSchema>;
