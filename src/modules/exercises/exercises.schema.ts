import { z } from 'zod';

export const exerciseListQuerySchema = z.object({
  q: z.string().optional(),
  muscle: z.string().optional(),
  equipment: z.string().optional(),
  movement: z.string().optional(),
  difficulty: z.string().optional(),
  lang: z.string().default('it'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const exerciseSlugParamSchema = z.object({
  slug: z.string().min(1),
});

export const exerciseMatchQuerySchema = z.object({
  lang: z.string().default('it'),
});

export type ExerciseListQuery = z.infer<typeof exerciseListQuerySchema>;
export type ExerciseMatchQuery = z.infer<typeof exerciseMatchQuerySchema>;
