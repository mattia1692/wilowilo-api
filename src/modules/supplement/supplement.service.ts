import type { PrismaClient } from '@prisma/client';
import type { SupplementBody } from './supplement.schema';

export async function getSupplements(prisma: PrismaClient, userId: string) {
  return prisma.supplement.findMany({
    where: { userId },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true, date: true, time: true, kind: true,
      name: true, quantity: true, unit: true, kcal: true,
    },
  });
}

export async function upsertSupplement(
  prisma: PrismaClient,
  userId: string,
  id: string,
  body: SupplementBody,
) {
  return prisma.supplement.upsert({
    where: { id },
    create: { id, userId, ...body },
    update: { userId, ...body },
  });
}

export async function deleteSupplement(prisma: PrismaClient, userId: string, id: string) {
  await prisma.supplement.deleteMany({ where: { id, userId } });
}
