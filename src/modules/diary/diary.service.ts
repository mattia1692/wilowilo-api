import type { PrismaClient } from '@prisma/client';
import type { FoodItem, DayMetaBody } from './diary.schema';

export async function setDayItems(
  prisma: PrismaClient,
  userId: string,
  date: string,
  items: Record<string, FoodItem[]>,
) {
  return prisma.diaryDay.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, items },
    update: { items },
  });
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

// Reads items JSON as a typed Record
function parseItems(raw: unknown): Record<string, FoodItem[]> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return raw as Record<string, FoodItem[]>;
}

export async function addFoodItem(
  prisma: PrismaClient,
  userId: string,
  date: string,
  meal: string,
  item: FoodItem,
) {
  const existing = await prisma.diaryDay.findUnique({
    where: { userId_date: { userId, date } },
  });

  const items = parseItems(existing?.items);
  const mealItems = Array.isArray(items[meal]) ? [...items[meal]] : [];
  mealItems.push(item);
  items[meal] = mealItems;

  return prisma.diaryDay.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, items },
    update: { items },
  });
}

export async function removeFoodItem(
  prisma: PrismaClient,
  userId: string,
  date: string,
  meal: string,
  idx: number,
) {
  const existing = await prisma.diaryDay.findUnique({
    where: { userId_date: { userId, date } },
  });
  if (!existing) return null;

  const items = parseItems(existing.items);
  const mealItems = Array.isArray(items[meal]) ? [...items[meal]] : [];
  mealItems.splice(idx, 1);
  items[meal] = mealItems;

  return prisma.diaryDay.update({
    where: { userId_date: { userId, date } },
    data: { items },
  });
}

export async function removeItemById(
  prisma: PrismaClient,
  userId: string,
  date: string,
  meal: string,
  itemId: string,
) {
  const existing = await prisma.diaryDay.findUnique({
    where: { userId_date: { userId, date } },
  });
  if (!existing) return null;

  const items = parseItems(existing.items);
  const mealItems = Array.isArray(items[meal]) ? [...items[meal]] : [];
  const filtered = mealItems.filter((item) => (item as Record<string, unknown>)['_id'] !== itemId);
  if (filtered.length === mealItems.length) return null; // not found — no-op
  items[meal] = filtered;

  return prisma.diaryDay.update({
    where: { userId_date: { userId, date } },
    data: { items },
  });
}

export async function updateDayMeta(
  prisma: PrismaClient,
  userId: string,
  date: string,
  meta: DayMetaBody,
) {
  return prisma.diaryDay.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, items: {}, ...meta },
    update: meta,
  });
}

export async function getToday(prisma: PrismaClient, userId: string) {
  return prisma.diaryDay.findUnique({
    where: { userId_date: { userId, date: todayKey() } },
  });
}

export async function getHistory(prisma: PrismaClient, userId: string) {
  return prisma.diaryDay.findMany({
    where: { userId, date: { not: todayKey() } },
    orderBy: { date: 'desc' },
  });
}
