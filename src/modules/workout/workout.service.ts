import type { PrismaClient } from '@prisma/client';
import type { WorkoutNoteBody } from './workout.schema';

export async function getWorkoutNotes(prisma: PrismaClient, userId: string) {
  return prisma.workoutNote.findMany({
    where: { userId },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
  });
}

export async function upsertWorkoutNote(
  prisma: PrismaClient,
  userId: string,
  id: string,
  data: WorkoutNoteBody,
) {
  return prisma.workoutNote.upsert({
    where: { id },
    create: { id, userId, ...data },
    update: { ...data },
  });
}

export async function deleteWorkoutNote(prisma: PrismaClient, userId: string, id: string) {
  await prisma.workoutNote.deleteMany({ where: { id, userId } });
}
