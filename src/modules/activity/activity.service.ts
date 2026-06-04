import type { PrismaClient } from '@prisma/client';
import type { ActivityBody } from './activity.schema';

export async function upsertActivity(prisma: PrismaClient, userId: string, id: string, body: ActivityBody) {
  return prisma.activity.upsert({
    where: { id },
    create: { id, userId, ...body },
    update: { userId, ...body },
  });
}

export async function deleteActivity(prisma: PrismaClient, userId: string, id: string) {
  await prisma.activity.deleteMany({ where: { id, userId } });
}

export async function getActivities(prisma: PrismaClient, userId: string) {
  return prisma.activity.findMany({
    where: { userId },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true, date: true, time: true, type: true, name: true,
      icon: true, color: true, duration: true, intensity: true,
      distance: true, kcal: true, addToBudget: true,
    },
  });
}
