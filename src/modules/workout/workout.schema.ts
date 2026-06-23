import { z } from 'zod';

const workoutSetSchema = z.object({
  reps:        z.number().int().min(0).optional(),
  weight:      z.number().min(0).optional(),
  intensity:   z.enum(['leggera', 'media', 'intensa']).optional(),
  km:          z.number().min(0).optional(),
  timeMinutes: z.number().min(0).optional(),
  duration:    z.number().int().min(0).optional(), // riposo in secondi
});

const workoutExerciseSchema = z.object({
  name:         z.string().min(1),
  type:         z.enum(['strength', 'cardio']).optional(),
  sets:         z.array(workoutSetSchema).min(1),
  restSeconds:  z.number().int().min(0).optional(),
  notes:        z.string().optional(),
  exerciseSlug: z.string().optional(),
  posterUrl:    z.string().optional(),
});

export const workoutNoteBodySchema = z.object({
  date:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data non valida'),
  title:     z.string().optional(),
  exercises: z.array(workoutExerciseSchema).min(1),
  notes:     z.string().optional(),
});

export const idParamSchema = z.object({ id: z.string().min(1) });

export type WorkoutNoteBody = z.infer<typeof workoutNoteBodySchema>;
