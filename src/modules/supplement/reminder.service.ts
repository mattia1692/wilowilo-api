import type { PrismaClient } from '@prisma/client';
import type { ReminderBody, ReminderPatch } from './reminder.schema';

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function getReminders(prisma: PrismaClient, userId: string) {
  return prisma.supplementReminder.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

// Returns active reminders for today that have NOT yet been taken today
export async function getPendingRemindersToday(prisma: PrismaClient, userId: string) {
  const today = todayKey();
  const active = await prisma.supplementReminder.findMany({
    where: {
      userId,
      isActive: true,
      startDate: { lte: today },
      OR: [{ endDate: null }, { endDate: { gte: today } }],
    },
  });

  // Find which reminders were already taken today
  const takenIds = new Set(
    (await prisma.supplement.findMany({
      where: { userId, date: today, reminderId: { not: null } },
      select: { reminderId: true },
    })).map((s) => s.reminderId!),
  );

  return active.filter((r) => !takenIds.has(r.id));
}

export async function upsertReminder(
  prisma: PrismaClient, userId: string, id: string, data: ReminderBody,
) {
  return prisma.supplementReminder.upsert({
    where: { id },
    create: { id, userId, ...data },
    update: { ...data },
  });
}

export async function patchReminder(
  prisma: PrismaClient, userId: string, id: string, data: ReminderPatch,
) {
  const result = await prisma.supplementReminder.updateMany({
    where: { id, userId },
    data,
  });
  if (result.count === 0) return null;
  return prisma.supplementReminder.findUnique({ where: { id } });
}

export async function deleteReminder(prisma: PrismaClient, userId: string, id: string) {
  await prisma.supplementReminder.deleteMany({ where: { id, userId } });
}

// Mark a reminder as taken today: creates a Supplement entry
export async function takeReminder(prisma: PrismaClient, userId: string, reminderId: string) {
  const reminder = await prisma.supplementReminder.findFirst({
    where: { id: reminderId, userId },
  });
  if (!reminder) return null;

  const today = todayKey();

  // Idempotent: don't create duplicate
  const existing = await prisma.supplement.findFirst({
    where: { userId, date: today, reminderId },
  });
  if (existing) return existing;

  return prisma.supplement.create({
    data: {
      id:         `${Date.now()}-${reminderId}`,
      userId,
      date:       today,
      kind:       reminder.kind,
      name:       reminder.name,
      quantity:   reminder.dosage,
      unit:       reminder.unit,
      reminderId,
    },
  });
}

// Remove a "taken" marker for today (undo checkbox)
export async function untakeReminder(prisma: PrismaClient, userId: string, reminderId: string) {
  const today = todayKey();
  await prisma.supplement.deleteMany({
    where: { userId, date: today, reminderId },
  });
}
