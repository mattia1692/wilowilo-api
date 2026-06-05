import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../../shared/middleware/auth';
import { supplementBodySchema, idParamSchema } from './supplement.schema';
import { upsertSupplement, deleteSupplement } from './supplement.service';
import { ValidationError } from '../../shared/errors';

export async function supplementRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);

  // PUT /supplements/:id — upsert supplemento/farmaco
  fastify.put('/:id', async (request, reply) => {
    const userId = request.user.sub;
    const paramsParsed = idParamSchema.safeParse(request.params);
    if (!paramsParsed.success) throw new ValidationError('ID non valido');

    const bodyParsed = supplementBodySchema.safeParse(request.body);
    if (!bodyParsed.success) throw new ValidationError(bodyParsed.error.issues[0]?.message ?? 'Dati non validi');

    const supplement = await upsertSupplement(fastify.prisma, userId, paramsParsed.data.id, bodyParsed.data);
    return reply.send(supplement);
  });

  // DELETE /supplements/:id — elimina supplemento/farmaco
  fastify.delete('/:id', async (request, reply) => {
    const userId = request.user.sub;
    const parsed = idParamSchema.safeParse(request.params);
    if (!parsed.success) throw new ValidationError('ID non valido');

    await deleteSupplement(fastify.prisma, userId, parsed.data.id);
    return reply.status(204).send();
  });
}
