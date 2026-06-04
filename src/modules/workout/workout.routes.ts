import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../../shared/middleware/auth';
import { workoutNoteBodySchema, idParamSchema } from './workout.schema';
import { upsertWorkoutNote, deleteWorkoutNote } from './workout.service';
import { ValidationError } from '../../shared/errors';

export async function workoutRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);

  // PUT /workout/:id — crea o aggiorna una nota allenamento
  fastify.put('/:id', async (request, reply) => {
    const userId = request.user.sub;
    const paramsParsed = idParamSchema.safeParse(request.params);
    if (!paramsParsed.success) throw new ValidationError('ID non valido');

    const bodyParsed = workoutNoteBodySchema.safeParse(request.body);
    if (!bodyParsed.success) throw new ValidationError(bodyParsed.error.issues[0]?.message ?? 'Dati non validi');

    const note = await upsertWorkoutNote(fastify.prisma, userId, paramsParsed.data.id, bodyParsed.data);
    return reply.send(note);
  });

  // DELETE /workout/:id — elimina nota allenamento
  fastify.delete('/:id', async (request, reply) => {
    const userId = request.user.sub;
    const parsed = idParamSchema.safeParse(request.params);
    if (!parsed.success) throw new ValidationError('ID non valido');

    await deleteWorkoutNote(fastify.prisma, userId, parsed.data.id);
    return reply.status(204).send();
  });
}
