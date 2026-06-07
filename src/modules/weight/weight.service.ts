import type { PrismaClient } from '@prisma/client';
import type { CheckpointBody, CheckpointPatch } from './weight.schema';

export async function upsertWeight(prisma: PrismaClient, userId: string, date: string, weight: number, note?: string) {
  return prisma.weightEntry.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, weight, note },
    update: { weight, note },
  });
}

export async function deleteWeight(prisma: PrismaClient, userId: string, date: string) {
  await prisma.weightEntry.deleteMany({ where: { userId, date } });
}

export async function getWeights(prisma: PrismaClient, userId: string) {
  return prisma.weightEntry.findMany({
    where: { userId },
    orderBy: { date: 'asc' },
  });
}

export async function upsertCheckpoint(prisma: PrismaClient, userId: string, id: string, body: CheckpointBody) {
  return prisma.weightCheckpoint.upsert({
    where: { id },
    create: { id, userId, ...body },
    update: { ...body },
  });
}

export async function patchCheckpoint(prisma: PrismaClient, userId: string, id: string, body: CheckpointPatch) {
  return prisma.weightCheckpoint.updateMany({
    where: { id, userId },
    data: body,
  });
}

export async function deleteCheckpoint(prisma: PrismaClient, userId: string, id: string) {
  await prisma.weightCheckpoint.deleteMany({ where: { id, userId } });
}

export async function getCheckpoints(prisma: PrismaClient, userId: string) {
  return prisma.weightCheckpoint.findMany({
    where: { userId },
    orderBy: { date: 'asc' },
  });
}
