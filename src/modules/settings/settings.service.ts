import type { PrismaClient } from '@prisma/client';
import type { SettingsPatch } from './settings.schema';

export async function getSettings(prisma: PrismaClient, userId: string) {
  return prisma.userSettings.findUnique({ where: { userId } });
}

export async function patchSettings(prisma: PrismaClient, userId: string, patch: SettingsPatch) {
  const { meals, mealTimes, ...rest } = patch;
  const data: Record<string, unknown> = { ...rest };
  if (meals !== undefined) data['meals'] = meals;
  if (mealTimes !== undefined) data['mealTimes'] = mealTimes;

  return prisma.userSettings.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
}
