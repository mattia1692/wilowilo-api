import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../../shared/middleware/auth';
import { addItemBodySchema, dayMetaBodySchema, itemParamsSchema, itemByIdParamsSchema, dateParamSchema } from './diary.schema';
import { addFoodItem, removeFoodItem, removeItemById, updateDayMeta } from './diary.service';
import { ValidationError } from '../../shared/errors';

export async function diaryRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);

  // POST /diary/items — aggiunge un alimento a un pasto di una data
  fastify.post('/items', async (request, reply) => {
    const userId = request.user.sub;
    const parsed = addItemBodySchema.safeParse(request.body);
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? 'Dati non validi');

    const day = await addFoodItem(
      fastify.prisma, userId,
      parsed.data.date, parsed.data.meal, parsed.data.item,
    );
    return reply.status(201).send(day);
  });

  // DELETE /diary/items/:date/:meal/:idx — rimuove un alimento per indice
  fastify.delete('/items/:date/:meal/:idx', async (request, reply) => {
    const userId = request.user.sub;
    const parsed = itemParamsSchema.safeParse(request.params);
    if (!parsed.success) throw new ValidationError('Parametri non validi');

    await removeFoodItem(
      fastify.prisma, userId,
      parsed.data.date, parsed.data.meal, parsed.data.idx,
    );
    return reply.status(204).send();
  });

  // DELETE /diary/items/:date/:meal/by-id/:itemId — rimuove per _id stabile
  fastify.delete('/items/:date/:meal/by-id/:itemId', async (request, reply) => {
    const userId = request.user.sub;
    const parsed = itemByIdParamsSchema.safeParse(request.params);
    if (!parsed.success) throw new ValidationError('Parametri non validi');

    await removeItemById(
      fastify.prisma, userId,
      parsed.data.date, parsed.data.meal, parsed.data.itemId,
    );
    return reply.status(204).send();
  });

  // PATCH /diary/days/:date — aggiorna fame/umore/acqua
  fastify.patch('/days/:date', async (request, reply) => {
    const userId = request.user.sub;
    const paramsParsed = dateParamSchema.safeParse(request.params);
    if (!paramsParsed.success) throw new ValidationError('Data non valida');

    const bodyParsed = dayMetaBodySchema.safeParse(request.body);
    if (!bodyParsed.success) throw new ValidationError(bodyParsed.error.issues[0]?.message ?? 'Dati non validi');

    const day = await updateDayMeta(
      fastify.prisma, userId,
      paramsParsed.data.date, bodyParsed.data,
    );
    return reply.send(day);
  });
}
