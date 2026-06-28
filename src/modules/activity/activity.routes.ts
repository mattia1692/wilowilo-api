import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../../shared/middleware/auth';
import { activityBodySchema, idParamSchema } from './activity.schema';
import { upsertActivity, deleteActivity, aiAnalyzeActivity } from './activity.service';
import { ValidationError } from '../../shared/errors';

export async function activityRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);

  // POST /activities/ai/analyze — interpreta testo libero → estrae tipo, durata, intensità
  fastify.post('/ai/analyze', async (request, reply) => {
    const { text } = request.body as { text?: string };
    if (!text?.trim()) throw new ValidationError('Testo mancante');
    const result = await aiAnalyzeActivity(text.trim());
    return reply.send(result);
  });

  // PUT /activities/:id — upsert attività
  fastify.put('/:id', async (request, reply) => {
    const userId = request.user.sub;
    const paramsParsed = idParamSchema.safeParse(request.params);
    if (!paramsParsed.success) throw new ValidationError('ID non valido');

    const bodyParsed = activityBodySchema.safeParse(request.body);
    if (!bodyParsed.success) throw new ValidationError(bodyParsed.error.issues[0]?.message ?? 'Dati non validi');

    const activity = await upsertActivity(fastify.prisma, userId, paramsParsed.data.id, bodyParsed.data);
    return reply.send(activity);
  });

  // PATCH /activities/:id — aggiorna parzialmente
  fastify.patch('/:id', async (request, reply) => {
    const userId = request.user.sub;
    const paramsParsed = idParamSchema.safeParse(request.params);
    if (!paramsParsed.success) throw new ValidationError('ID non valido');

    const body = request.body as Record<string, unknown>;
    const activity = await fastify.prisma.activity.updateMany({
      where: { id: paramsParsed.data.id, userId },
      data: body,
    });
    if (activity.count === 0) return reply.status(404).send({ error: 'Not found' });
    const updated = await fastify.prisma.activity.findUnique({ where: { id: paramsParsed.data.id } });
    return reply.send(updated);
  });

  // DELETE /activities/:id — elimina attività
  fastify.delete('/:id', async (request, reply) => {
    const userId = request.user.sub;
    const parsed = idParamSchema.safeParse(request.params);
    if (!parsed.success) throw new ValidationError('ID non valido');

    await deleteActivity(fastify.prisma, userId, parsed.data.id);
    return reply.status(204).send();
  });
}
