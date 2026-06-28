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
  weightObjective: z.string().nullable().optional(),
  goalDate: z.string().nullable().optional(),
  height: z.number().int().min(100).max(250).nullable().optional(),
  age: z.number().int().min(10).max(120).nullable().optional(),
  gender: z.string().nullable().optional(),
  activityLevel: z.number().min(1.0).max(2.5).nullable().optional(),
});

export type SettingsPatch = z.infer<typeof settingsPatchSchema>;
