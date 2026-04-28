import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../../shared/middleware/auth';
import { customFoodBodySchema, idParamSchema, aiAnalyzeSchema, aiSuggestSchema, aiPlanSchema, aiPhotoSchema, aiUnifiedSchema } from './foods.schema';
import {
  getCustomFoods, upsertCustomFood, deleteCustomFood,
  searchFoods, searchFoodsExtended, lookupBarcode,
  aiAnalyze, aiSuggest, aiPlan, aiAnalyzePhoto, aiAnalyzeUnified, checkAiRate,
} from './foods.service';
import { ValidationError, RateLimitError } from '../../shared/errors';

export async function foodsRoutes(fastify: FastifyInstance) {

  // ── Food search (no auth) ─────────────────────────────────────────────────────

  fastify.get('/search', async (request, reply) => {
    const { q } = request.query as { q?: string };
    if (!q?.trim()) return reply.send({ products: [] });
    return reply.send(await searchFoods(q));
  });

  fastify.get('/search/extended', async (request, reply) => {
    const { q } = request.query as { q?: string };
    if (!q?.trim()) return reply.send({ products: [] });
    return reply.send(await searchFoodsExtended(q));
  });

  fastify.get('/barcode/:barcode', async (request, reply) => {
    const { barcode } = request.params as { barcode: string };
    const clean = barcode.replace(/[^0-9]/g, '');
    if (!clean) return reply.send({ products: [] });
    return reply.send(await lookupBarcode(clean));
  });

  // ── Custom foods (auth required) ──────────────────────────────────────────────

  fastify.register(async (authed) => {
    authed.addHook('preHandler', requireAuth);

    // GET /foods/mine — lista cibi personali
    authed.get('/mine', async (request, reply) => {
      const foods = await getCustomFoods(fastify.prisma, request.user.sub);
      return reply.send(foods);
    });

    // PUT /foods/mine/:id — upsert cibo personale
    authed.put('/mine/:id', async (request, reply) => {
      const userId = request.user.sub;
      const paramsParsed = idParamSchema.safeParse(request.params);
      if (!paramsParsed.success) throw new ValidationError('ID non valido');

      const bodyParsed = customFoodBodySchema.safeParse(request.body);
      if (!bodyParsed.success) throw new ValidationError(bodyParsed.error.issues[0]?.message ?? 'Dati non validi');

      const food = await upsertCustomFood(fastify.prisma, userId, paramsParsed.data.id, bodyParsed.data);
      return reply.send(food);
    });

    // DELETE /foods/mine/:id — elimina cibo personale
    authed.delete('/mine/:id', async (request, reply) => {
      const userId = request.user.sub;
      const parsed = idParamSchema.safeParse(request.params);
      if (!parsed.success) throw new ValidationError('ID non valido');

      await deleteCustomFood(fastify.prisma, userId, parsed.data.id);
      return reply.status(204).send();
    });

    // ── AI endpoints (auth + rate limit) ─────────────────────────────────────────

    // POST /ai/analyze — scomposizione macro pasto libero
    authed.post('/ai/analyze', async (request, reply) => {
      const userId = request.user.sub;
      if (!checkAiRate(userId)) throw new RateLimitError();

      const parsed = aiAnalyzeSchema.safeParse(request.body);
      if (!parsed.success) throw new ValidationError('Campo food mancante');

      return reply.send(await aiAnalyze(parsed.data.food));
    });

    // POST /ai/suggest — suggerimenti per macro rimanenti
    authed.post('/ai/suggest', async (request, reply) => {
      const userId = request.user.sub;
      if (!checkAiRate(userId)) throw new RateLimitError();

      const parsed = aiSuggestSchema.safeParse(request.body);
      if (!parsed.success) throw new ValidationError('Parametri non validi');

      return reply.send(await aiSuggest(parsed.data.remaining));
    });

    // POST /ai/plan — piano pasto per obiettivi
    authed.post('/ai/plan', async (request, reply) => {
      const userId = request.user.sub;
      if (!checkAiRate(userId)) throw new RateLimitError();

      const parsed = aiPlanSchema.safeParse(request.body);
      if (!parsed.success) throw new ValidationError('Parametri non validi');

      return reply.send(await aiPlan(parsed.data));
    });

    // POST /ai/analyze-photo — stima macro da foto (legacy)
    authed.post('/ai/analyze-photo', { bodyLimit: 4 * 1024 * 1024 }, async (request, reply) => {
      const userId = request.user.sub;
      if (!checkAiRate(userId)) throw new RateLimitError();

      const parsed = aiPhotoSchema.safeParse(request.body);
      if (!parsed.success) throw new ValidationError('Immagine mancante o non valida');

      return reply.send(await aiAnalyzePhoto(parsed.data.image, parsed.data.mediaType));
    });

    // POST /ai/analyze-unified — testo + foto opzionali
    authed.post('/ai/analyze-unified', { bodyLimit: 10 * 1024 * 1024 }, async (request, reply) => {
      const userId = request.user.sub;
      if (!checkAiRate(userId)) throw new RateLimitError();

      const parsed = aiUnifiedSchema.safeParse(request.body);
      if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? 'Parametri non validi');

      return reply.send(await aiAnalyzeUnified(parsed.data.food, parsed.data.images));
    });
  });
}
