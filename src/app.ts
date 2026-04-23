import Fastify from 'fastify';
import prismaPlugin from './plugins/prisma';
import authPlugin from './plugins/auth';
import corsPlugin from './plugins/cors';
import { authRoutes } from './modules/auth/auth.routes';
import { diaryRoutes } from './modules/diary/diary.routes';
import { weightRoutes } from './modules/weight/weight.routes';
import { settingsRoutes } from './modules/settings/settings.routes';
import { foodsRoutes } from './modules/foods/foods.routes';
import { getToday, getHistory } from './modules/diary/diary.service';
import { getWeights, getCheckpoints } from './modules/weight/weight.service';
import { getCustomFoods } from './modules/foods/foods.service';
import { getSettings } from './modules/settings/settings.service';
import { requireAuth } from './shared/middleware/auth';
import { AppError } from './shared/errors';
import type { FastifyInstance } from 'fastify';

export async function buildApp(): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: process.env.NODE_ENV !== 'production',
  });

  // Plugins (order matters: db → auth → cors)
  await fastify.register(prismaPlugin);
  await fastify.register(authPlugin);
  await fastify.register(corsPlugin);

  // Global error handler
  fastify.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({ code: error.code, message: error.message });
    }
    fastify.log.error(error);
    return reply.status(500).send({ code: 'INTERNAL_ERROR', message: 'Errore interno del server' });
  });

  // Health check
  fastify.get('/health', async () => ({ status: 'ok' }));

  // ── Init endpoint — carica tutti i dati utente in una sola chiamata ─────────
  fastify.get('/init', { preHandler: requireAuth }, async (request, reply) => {
    const userId = request.user.sub;
    const [settings, today, history, weights, checkpoints, customFoods] = await Promise.all([
      getSettings(fastify.prisma, userId),
      getToday(fastify.prisma, userId),
      getHistory(fastify.prisma, userId),
      getWeights(fastify.prisma, userId),
      getCheckpoints(fastify.prisma, userId),
      getCustomFoods(fastify.prisma, userId),
    ]);
    return reply.send({ settings, today, history, weights, checkpoints, customFoods });
  });

  // Module routes
  await fastify.register(authRoutes, { prefix: '/auth' });
  await fastify.register(diaryRoutes, { prefix: '/diary' });
  await fastify.register(weightRoutes, { prefix: '/weight' });
  await fastify.register(settingsRoutes, { prefix: '/settings' });
  await fastify.register(foodsRoutes, { prefix: '/food' });

  // ── One-time Firebase → PostgreSQL migration endpoint ─────────────────────
  // Enabled only when MIGRATION_SECRET env var is set.
  // POST /admin/migrate  { uid, email, data: <tracker JSON> }
  // Header: x-migration-secret: <MIGRATION_SECRET>
  fastify.post('/admin/migrate', async (request, reply) => {
    const secret = process.env.MIGRATION_SECRET;
    if (!secret) return reply.status(404).send({ error: 'Not found' });
    if (request.headers['x-migration-secret'] !== secret) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
    const { uid, email, data } = request.body as {
      uid: string;
      email: string;
      data: Record<string, unknown>;
    };
    if (!uid || !email || !data) return reply.status(400).send({ error: 'uid, email, data required' });

    const db = fastify.prisma;
    const results: Record<string, number> = {};

    await db.user.upsert({ where: { id: uid }, update: { email }, create: { id: uid, email } });

    // Settings
    const t = (data.targets ?? {}) as Record<string, number>;
    const meals = Array.isArray(data.meals) ? data.meals as string[] : [];
    await db.userSettings.upsert({
      where: { userId: uid },
      update: { kcal: t.kcal ?? 0, protein: t.protein ?? 0, carbs: t.carbs ?? 0, fat: t.fat ?? 0, satfat: t.satfat ?? 0, fiber: t.fiber ?? 0, waterTarget: t.waterTarget ?? 8, meals, sheetsUrl: (data.sheetsUrl as string) ?? '', lang: (data.lang as string) ?? 'it', weightHidden: (data.weightHidden as boolean) ?? false, wizardCompleted: (data.wizardCompleted as boolean) ?? false, startWeight: (data.startWeight as number) ?? null, goalWeight: null },
      create: { userId: uid, kcal: t.kcal ?? 0, protein: t.protein ?? 0, carbs: t.carbs ?? 0, fat: t.fat ?? 0, satfat: t.satfat ?? 0, fiber: t.fiber ?? 0, waterTarget: t.waterTarget ?? 8, meals, sheetsUrl: (data.sheetsUrl as string) ?? '', lang: (data.lang as string) ?? 'it', weightHidden: (data.weightHidden as boolean) ?? false, wizardCompleted: (data.wizardCompleted as boolean) ?? false, startWeight: (data.startWeight as number) ?? null, goalWeight: null },
    });

    // DiaryDays
    const history = (data.history ?? {}) as Record<string, { date?: string; items: object; hunger?: number | null; mood?: number | null; water?: number | null }>;
    let diaryCount = 0;
    for (const [dateKey, day] of Object.entries(history)) {
      const date = day.date ?? dateKey;
      if (!date) continue;
      await db.diaryDay.upsert({ where: { userId_date: { userId: uid, date } }, update: { items: day.items as object, hunger: day.hunger ?? null, mood: day.mood ?? null, water: day.water ?? null }, create: { userId: uid, date, items: day.items as object, hunger: day.hunger ?? null, mood: day.mood ?? null, water: day.water ?? null } });
      diaryCount++;
    }
    results.diaryDays = diaryCount;

    // WeightEntries
    const weight = (data.weight ?? {}) as Record<string, { date?: string; weight: number }>;
    let wCount = 0;
    for (const [key, entry] of Object.entries(weight)) {
      if (!entry?.weight) continue;
      const date = entry.date ?? key;
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      await db.weightEntry.upsert({ where: { userId_date: { userId: uid, date } }, update: { weight: entry.weight }, create: { userId: uid, date, weight: entry.weight } });
      wCount++;
    }
    results.weights = wCount;

    // Checkpoints
    const checkpoints = (data.checkpoints ?? {}) as Record<string, { id?: string; date: string; targetWeight: number; label?: string }>;
    let cpCount = 0;
    const seen = new Set<string>();
    for (const [cpKey, cp] of Object.entries(checkpoints)) {
      if (!cp?.date || !cp?.targetWeight) continue;
      const id = cp.id ?? cpKey;
      if (seen.has(id)) continue;
      seen.add(id);
      await db.weightCheckpoint.upsert({ where: { id }, update: { date: cp.date, targetWeight: cp.targetWeight, label: cp.label ?? null }, create: { id, userId: uid, date: cp.date, targetWeight: cp.targetWeight, label: cp.label ?? null } });
      cpCount++;
    }
    results.checkpoints = cpCount;

    // CustomFoods
    const myFoods = (data.my_foods ?? {}) as Record<string, { id?: string; name: string; brand?: string; per100g: object; createdAt?: string }>;
    let fCount = 0;
    for (const [fKey, food] of Object.entries(myFoods)) {
      if (!food?.name || !food?.per100g) continue;
      const id = food.id ?? fKey;
      const createdAt = food.createdAt ? new Date(food.createdAt) : new Date();
      await db.customFood.upsert({ where: { id }, update: { name: food.name, brand: food.brand ?? null, per100g: food.per100g as object }, create: { id, userId: uid, name: food.name, brand: food.brand ?? null, per100g: food.per100g as object, createdAt } });
      fCount++;
    }
    results.customFoods = fCount;

    return reply.send({ ok: true, uid, results });
  });

  // Legacy root POST endpoint — backward compat durante la migrazione pwa.
  // Verifica Firebase token (vecchio schema), esegue le stesse logiche AI.
  fastify.post('/', async (request, reply) => {
    const authHeader = (request.headers.authorization as string) || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) return reply.status(401).send({ error: 'Autenticazione richiesta' });

    const { verifyFirebaseToken } = await import('./modules/auth/auth.service');
    const { checkAiRate, aiAnalyze, aiSuggest, aiPlan } = await import('./modules/foods/foods.service');

    let fbUser: { localId: string; email: string };
    try {
      fbUser = await verifyFirebaseToken(idToken);
    } catch {
      return reply.status(401).send({ error: 'Token non valido o scaduto' });
    }

    if (!checkAiRate(fbUser.localId)) {
      return reply.status(429).send({ error: "Troppe richieste. Riprova tra un'ora." });
    }

    const payload = request.body as Record<string, unknown>;
    if (payload.type === 'suggest') {
      return reply.send(await aiSuggest(payload.remaining as Parameters<typeof aiSuggest>[0]));
    }
    if (payload.type === 'plan') {
      return reply.send(await aiPlan(payload as Parameters<typeof aiPlan>[0]));
    }
    if (!payload.food || typeof payload.food !== 'string') {
      return reply.status(400).send({ error: 'Campo food mancante' });
    }
    return reply.send(await aiAnalyze(payload.food.slice(0, 500)));
  });

  return fastify;
}
