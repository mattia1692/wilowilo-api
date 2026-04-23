import jwt from 'jsonwebtoken';
import type { PrismaClient } from '@prisma/client';
import { UnauthorizedError } from '../../shared/errors';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'change-me-access';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'change-me-refresh';
const ACCESS_EXPIRES = '1h';
const REFRESH_EXPIRES = '30d';
const REFRESH_COOKIE = 'wilo_refresh';

interface FirebaseUser {
  localId: string;
  email: string;
}

export async function verifyFirebaseToken(idToken: string): Promise<FirebaseUser> {
  const apiKey = process.env.FIREBASE_API_KEY;
  if (!apiKey) throw new UnauthorizedError('Configurazione server non valida');

  const resp = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    },
  );

  if (!resp.ok) throw new UnauthorizedError('Token Firebase non valido');
  const data = (await resp.json()) as { users?: { localId: string; email: string }[] };
  const user = data.users?.[0];
  if (!user?.localId) throw new UnauthorizedError('Token Firebase non valido');

  return { localId: user.localId, email: user.email || '' };
}

export function signAccessToken(payload: { sub: string; email: string }): string {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES });
}

export function signRefreshToken(payload: { sub: string }): string {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES });
}

export function verifyRefreshToken(token: string): { sub: string } {
  try {
    return jwt.verify(token, REFRESH_SECRET) as { sub: string };
  } catch {
    throw new UnauthorizedError('Refresh token non valido o scaduto');
  }
}

export function getRefreshCookieName(): string {
  return REFRESH_COOKIE;
}

export function getRefreshCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 30 * 24 * 60 * 60, // 30d in seconds
  };
}

export async function loginOrRegister(prisma: PrismaClient, fbUser: FirebaseUser) {
  const user = await prisma.user.upsert({
    where: { id: fbUser.localId },
    create: { id: fbUser.localId, email: fbUser.email },
    update: { email: fbUser.email },
  });
  return user;
}

export async function getUserById(prisma: PrismaClient, id: string) {
  return prisma.user.findUnique({ where: { id } });
}

/**
 * If FIREBASE_DB_URL is set and the user has no settings yet (first login),
 * read from Firebase RTDB and migrate diary/weight/settings into PostgreSQL.
 * Runs best-effort — failures are logged but do not block login.
 */
export async function maybeMigrateFromFirebase(
  prisma: PrismaClient,
  uid: string,
  idToken: string,
): Promise<void> {
  const dbUrl = process.env.FIREBASE_DB_URL;
  if (!dbUrl) return;

  const existing = await prisma.userSettings.findUnique({ where: { userId: uid }, select: { userId: true } });
  if (existing) return; // Already migrated

  try {
    const url = `${dbUrl}/users/${uid}/macro_tracker.json?auth=${idToken}`;
    const res = await fetch(url);
    if (!res.ok) return;
    const data = await res.json() as Record<string, unknown> | null;
    if (!data) return;

    const t = (data.targets ?? {}) as Record<string, number>;
    const meals = Array.isArray(data.meals) ? data.meals as string[] : [];

    await prisma.userSettings.create({
      data: { userId: uid, kcal: t.kcal ?? 0, protein: t.protein ?? 0, carbs: t.carbs ?? 0, fat: t.fat ?? 0, satfat: t.satfat ?? 0, fiber: t.fiber ?? 0, waterTarget: t.waterTarget ?? 8, meals, sheetsUrl: (data.sheetsUrl as string) ?? '', lang: (data.lang as string) ?? 'it', weightHidden: (data.weightHidden as boolean) ?? false, wizardCompleted: (data.wizardCompleted as boolean) ?? false, startWeight: (data.startWeight as number) ?? null, goalWeight: (data.goalWeight as number) ?? null },
    });

    const history = (data.history ?? {}) as Record<string, { date?: string; items: object; hunger?: number | null; mood?: number | null; water?: number | null }>;
    for (const [dateKey, day] of Object.entries(history)) {
      const date = day.date ?? dateKey;
      if (!date) continue;
      await prisma.diaryDay.upsert({ where: { userId_date: { userId: uid, date } }, update: { items: day.items as object, hunger: day.hunger ?? null, mood: day.mood ?? null, water: day.water ?? null }, create: { userId: uid, date, items: day.items as object, hunger: day.hunger ?? null, mood: day.mood ?? null, water: day.water ?? null } });
    }

    if (data.today && typeof data.today === 'object') {
      const today = data.today as { date: string; items: object; hunger?: number | null; mood?: number | null; water?: number | null };
      if (today.date) {
        await prisma.diaryDay.upsert({ where: { userId_date: { userId: uid, date: today.date } }, update: { items: today.items as object, hunger: today.hunger ?? null, mood: today.mood ?? null, water: today.water ?? null }, create: { userId: uid, date: today.date, items: today.items as object, hunger: today.hunger ?? null, mood: today.mood ?? null, water: today.water ?? null } });
      }
    }

    const weight = (data.weight ?? {}) as Record<string, { date?: string; weight: number }>;
    for (const [key, entry] of Object.entries(weight)) {
      if (!entry?.weight) continue;
      const date = entry.date ?? key;
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      await prisma.weightEntry.upsert({ where: { userId_date: { userId: uid, date } }, update: { weight: entry.weight }, create: { userId: uid, date, weight: entry.weight } });
    }

    const checkpoints = (data.checkpoints ?? {}) as Record<string, { id?: string; date: string; targetWeight: number; label?: string }>;
    const seen = new Set<string>();
    for (const [cpKey, cp] of Object.entries(checkpoints)) {
      if (!cp?.date || !cp?.targetWeight) continue;
      const id = cp.id ?? cpKey;
      if (seen.has(id)) continue;
      seen.add(id);
      await prisma.weightCheckpoint.upsert({ where: { id }, update: { date: cp.date, targetWeight: cp.targetWeight, label: cp.label ?? null }, create: { id, userId: uid, date: cp.date, targetWeight: cp.targetWeight, label: cp.label ?? null } });
    }

    const myFoods = (data.my_foods ?? {}) as Record<string, { id?: string; name: string; brand?: string; per100g: object; createdAt?: string }>;
    for (const [fKey, food] of Object.entries(myFoods)) {
      if (!food?.name || !food?.per100g) continue;
      const id = food.id ?? fKey;
      const createdAt = food.createdAt ? new Date(food.createdAt) : new Date();
      await prisma.customFood.upsert({ where: { id }, update: { name: food.name, brand: food.brand ?? null, per100g: food.per100g as object }, create: { id, userId: uid, name: food.name, brand: food.brand ?? null, per100g: food.per100g as object, createdAt } });
    }

    console.log(`[auto-migrate] Migrated Firebase data for uid=${uid}`);
  } catch (e) {
    console.error('[auto-migrate] Failed:', e);
  }
}
