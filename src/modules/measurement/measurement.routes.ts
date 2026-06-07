import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../../shared/middleware/auth';
import { measurementBodySchema, idParamSchema } from './measurement.schema';
import { upsertMeasurement, deleteMeasurement } from './measurement.service';
import { ValidationError } from '../../shared/errors';

export async function measurementRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);

  // PUT /measurements/:id — upsert misurazione
  fastify.put('/:id', async (request, reply) => {
    const userId = request.user.sub;
    const paramsParsed = idParamSchema.safeParse(request.params);
    if (!paramsParsed.success) throw new ValidationError('ID non valido');

    const bodyParsed = measurementBodySchema.safeParse(request.body);
    if (!bodyParsed.success) throw new ValidationError(bodyParsed.error.issues[0]?.message ?? 'Dati non validi');

    const measurement = await upsertMeasurement(fastify.prisma, userId, paramsParsed.data.id, bodyParsed.data);
    return reply.send(measurement);
  });

  // DELETE /measurements/:id — elimina misurazione
  fastify.delete('/:id', async (request, reply) => {
    const userId = request.user.sub;
    const parsed = idParamSchema.safeParse(request.params);
    if (!parsed.success) throw new ValidationError('ID non valido');

    await deleteMeasurement(fastify.prisma, userId, parsed.data.id);
    return reply.status(204).send();
  });
}
