import type { PrismaClient } from '@prisma/client';
import type { MeasurementBody } from './measurement.schema';

export async function getMeasurements(prisma: PrismaClient, userId: string) {
  return prisma.bodyMeasurement.findMany({
    where: { userId },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    select: { id: true, date: true, type: true, value: true, unit: true, note: true },
  });
}

export async function upsertMeasurement(
  prisma: PrismaClient,
  userId: string,
  id: string,
  body: MeasurementBody,
) {
  return prisma.bodyMeasurement.upsert({
    where: { id },
    create: { id, userId, ...body },
    update: { userId, ...body },
  });
}

export async function deleteMeasurement(prisma: PrismaClient, userId: string, id: string) {
  await prisma.bodyMeasurement.deleteMany({ where: { id, userId } });
}
