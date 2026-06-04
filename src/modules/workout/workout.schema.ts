import { z } from 'zod';

const workoutSetSchema = z.object({
  reps:     z.number().int().min(0).optional(),
  weight:   z.number().min(0).optional(),   // kg
  duration: z.number().int().min(0).optional(), // secondi (per esercizi a tempo)
});

const workoutExerciseSchema = z.object({
  name:        z.string().min(1),
  sets:        z.array(workoutSetSchema).min(1),
  restSeconds: z.number().int().min(0).optional(),
});

export const workoutNoteBodySchema = z.object({
  date:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data non valida'),
  title:     z.string().optional(),
  exercises: z.array(workoutExerciseSchema).min(1),
  notes:     z.string().optional(),
});

export const idParamSchema = z.object({ id: z.string().min(1) });

export type WorkoutNoteBody = z.infer<typeof workoutNoteBodySchema>;
