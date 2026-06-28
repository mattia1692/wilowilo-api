import { z } from 'zod';

export const goalDomains = ['weight_composition', 'nutrition', 'training_strength', 'activity_movement', 'habits_consistency'] as const;
export const goalNatures = ['outcome', 'process'] as const;
export const goalDirections = ['reach', 'maintain', 'reduce'] as const;
export const goalPeriods = ['daily', 'weekly', 'milestone'] as const;
export const goalStatuses = ['active', 'near_target', 'achieved', 'paused', 'expired', 'archived'] as const;

export const goalTypes = [
  'target_weight', 'weekly_weight_rate', 'body_fat_pct', 'circumference',
  'daily_calories', 'macro_protein', 'macro_carbs', 'macro_fat', 'protein_per_kg', 'water_intake', 'diet_adherence',
  'workout_frequency', 'active_days', 'pr_one_rep_max', 'weekly_volume', 'complete_program',
  'daily_steps', 'activity_minutes', 'cardio_sessions',
  'logging_streak', 'workout_streak', 'perfect_week',
] as const;

export const goalBodySchema = z.object({
  domain: z.enum(goalDomains),
  type: z.string().min(1),
  nature: z.enum(goalNatures),
  direction: z.enum(goalDirections),
  title: z.string().min(1),
  targetValue: z.number(),
  unit: z.string().min(1),
  period: z.enum(goalPeriods),
  baselineValue: z.number().nullable().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  derivedFrom: z.string().nullable().optional(),
  exerciseId: z.string().nullable().optional(),
  status: z.enum(goalStatuses).default('active'),
  config: z.any().optional(),
});

export const goalPatchSchema = goalBodySchema.partial();

export const deriveBodySchema = z.object({
  primaryGoal: z.enum(['lose_weight', 'maintain', 'gain_muscle', 'improve_fitness']),
  targetWeight: z.number().positive().optional(),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  weeklyRate: z.number().optional(),
  height: z.number().int().min(100).max(250).optional(),
  age: z.number().int().min(10).max(120).optional(),
  gender: z.string().optional(),
  activityLevel: z.number().min(1.0).max(2.5).optional(),
  currentWeight: z.number().positive().optional(),
});

export const idParamSchema = z.object({ id: z.string().min(1) });

export type GoalBody = z.infer<typeof goalBodySchema>;
export type GoalPatch = z.infer<typeof goalPatchSchema>;
export type DeriveBody = z.infer<typeof deriveBodySchema>;
