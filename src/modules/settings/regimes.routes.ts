import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../../shared/middleware/auth';
import { upsertRegime, deleteRegime } from './settings.service';
import { ValidationError, NotFoundError } from '../../shared/errors';

const regimeBodySchema = z.object({
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: z.string().min(1).max(60).optional(),
  kcal: z.number().min(0),
  protein: z.number().min(0),
  carbs: z.number().min(0),
  fat: z.number().min(0),
  satfat: z.number().min(0).default(0),
  fiber: z.number().min(0).default(0),
});

export async function regimesRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);

  // PUT /regimes — crea o aggiorna un regime (upsert per effectiveDate)
  fastify.put('/', async (request, reply) => {
    const userId = request.user.sub;
    const parsed = regimeBodySchema.safeParse(request.body);
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? 'Dati non validi');
    const regime = await upsertRegime(fastify.prisma, userId, parsed.data);
    return reply.status(200).send(regime);
  });

  // DELETE /regimes/:id
  fastify.delete('/:id', async (request, reply) => {
    const userId = request.user.sub;
    const id = parseInt((request.params as { id: string }).id, 10);
    if (isNaN(id)) throw new ValidationError('ID non valido');
    await deleteRegime(fastify.prisma, userId, id);
    return reply.status(204).send();
  });
}
