import type { PrismaClient } from '@prisma/client';
import type { SettingsPatch } from './settings.schema';

const TARGET_FIELDS = ['kcal', 'protein', 'carbs', 'fat', 'satfat', 'fiber'] as const;

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getSettings(prisma: PrismaClient, userId: string) {
  return prisma.userSettings.findUnique({ where: { userId } });
}

export async function getTargetHistory(prisma: PrismaClient, userId: string) {
  return prisma.targetSnapshot.findMany({
    where: { userId },
    orderBy: { effectiveDate: 'asc' },
    select: { effectiveDate: true, kcal: true, protein: true, carbs: true, fat: true, satfat: true, fiber: true },
  });
}

export async function patchSettings(prisma: PrismaClient, userId: string, patch: SettingsPatch) {
  const { meals, mealTimes, ...rest } = patch;
  const data: Record<string, unknown> = { ...rest };
  if (meals !== undefined) data['meals'] = meals;
  if (mealTimes !== undefined) data['mealTimes'] = mealTimes;

  const settings = await prisma.userSettings.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });

  // Se cambiano valori target salva uno snapshot per oggi
  const hasTargetChange = TARGET_FIELDS.some((f) => patch[f] !== undefined);
  if (hasTargetChange) {
    const today = todayDate();
    await prisma.targetSnapshot.upsert({
      where: { userId_effectiveDate: { userId, effectiveDate: today } },
      create: {
        userId,
        effectiveDate: today,
        kcal: settings.kcal,
        protein: settings.protein,
        carbs: settings.carbs,
        fat: settings.fat,
        satfat: settings.satfat,
        fiber: settings.fiber,
      },
      update: {
        kcal: settings.kcal,
        protein: settings.protein,
        carbs: settings.carbs,
        fat: settings.fat,
        satfat: settings.satfat,
        fiber: settings.fiber,
      },
    });
  }

  return settings;
}
