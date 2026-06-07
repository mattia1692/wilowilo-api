import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../../shared/middleware/auth';
import {
  weightBodySchema, checkpointBodySchema, checkpointPatchSchema,
  dateParamSchema, idParamSchema,
} from './weight.schema';
import {
  upsertWeight, deleteWeight,
  upsertCheckpoint, patchCheckpoint, deleteCheckpoint,
} from './weight.service';
import { ValidationError } from '../../shared/errors';

export async function weightRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);

  // PUT /weight/:date — upsert pesata
  fastify.put('/:date', async (request, reply) => {
    const userId = request.user.sub;
    const paramsParsed = dateParamSchema.safeParse(request.params);
    if (!paramsParsed.success) throw new ValidationError('Data non valida');

    const bodyParsed = weightBodySchema.safeParse(request.body);
    if (!bodyParsed.success) throw new ValidationError('Peso non valido');

    const entry = await upsertWeight(fastify.prisma, userId, paramsParsed.data.date, bodyParsed.data.weight, bodyParsed.data.note);
    return reply.send(entry);
  });

  // DELETE /weight/:date — elimina pesata
  fastify.delete('/:date', async (request, reply) => {
    const userId = request.user.sub;
    const parsed = dateParamSchema.safeParse(request.params);
    if (!parsed.success) throw new ValidationError('Data non valida');

    await deleteWeight(fastify.prisma, userId, parsed.data.date);
    return reply.status(204).send();
  });

  // PUT /weight/checkpoints/:id — upsert checkpoint
  fastify.put('/checkpoints/:id', async (request, reply) => {
    const userId = request.user.sub;
    const paramsParsed = idParamSchema.safeParse(request.params);
    if (!paramsParsed.success) throw new ValidationError('ID non valido');

    const bodyParsed = checkpointBodySchema.safeParse(request.body);
    if (!bodyParsed.success) throw new ValidationError(bodyParsed.error.issues[0]?.message ?? 'Dati non validi');

    const cp = await upsertCheckpoint(fastify.prisma, userId, paramsParsed.data.id, bodyParsed.data);
    return reply.send(cp);
  });

  // PATCH /weight/checkpoints/:id — aggiorna checkpoint parzialmente
  fastify.patch('/checkpoints/:id', async (request, reply) => {
    const userId = request.user.sub;
    const paramsParsed = idParamSchema.safeParse(request.params);
    if (!paramsParsed.success) throw new ValidationError('ID non valido');

    const bodyParsed = checkpointPatchSchema.safeParse(request.body);
    if (!bodyParsed.success) throw new ValidationError(bodyParsed.error.issues[0]?.message ?? 'Dati non validi');

    await patchCheckpoint(fastify.prisma, userId, paramsParsed.data.id, bodyParsed.data);
    return reply.status(204).send();
  });

  // DELETE /weight/checkpoints/:id — elimina checkpoint
  fastify.delete('/checkpoints/:id', async (request, reply) => {
    const userId = request.user.sub;
    const parsed = idParamSchema.safeParse(request.params);
    if (!parsed.success) throw new ValidationError('ID non valido');

    await deleteCheckpoint(fastify.prisma, userId, parsed.data.id);
    return reply.status(204).send();
  });
}
