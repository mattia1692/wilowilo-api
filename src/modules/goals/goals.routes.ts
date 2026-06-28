import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../../shared/middleware/auth';
import { goalBodySchema, goalPatchSchema, deriveBodySchema, idParamSchema } from './goals.schema';
import { getGoals, upsertGoal, patchGoal, deleteGoal, deriveGoals } from './goals.service';
import { ValidationError } from '../../shared/errors';

export async function goalRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);

  fastify.get('/', async (request, reply) => {
    const goals = await getGoals(fastify.prisma, request.user.sub);
    return reply.send(goals);
  });

  fastify.put('/:id', async (request, reply) => {
    const params = idParamSchema.safeParse(request.params);
    if (!params.success) throw new ValidationError('ID non valido');
    const body = goalBodySchema.safeParse(request.body);
    if (!body.success) throw new ValidationError(body.error.issues[0]?.message ?? 'Dati non validi');
    const goal = await upsertGoal(fastify.prisma, request.user.sub, params.data.id, body.data);
    return reply.send(goal);
  });

  fastify.patch('/:id', async (request, reply) => {
    const params = idParamSchema.safeParse(request.params);
    if (!params.success) throw new ValidationError('ID non valido');
    const body = goalPatchSchema.safeParse(request.body);
    if (!body.success) throw new ValidationError(body.error.issues[0]?.message ?? 'Dati non validi');
    const goal = await patchGoal(fastify.prisma, request.user.sub, params.data.id, body.data);
    if (!goal) return reply.status(404).send({ error: 'Goal not found' });
    return reply.send(goal);
  });

  fastify.delete('/:id', async (request, reply) => {
    const params = idParamSchema.safeParse(request.params);
    if (!params.success) throw new ValidationError('ID non valido');
    await deleteGoal(fastify.prisma, request.user.sub, params.data.id);
    return reply.status(204).send();
  });

  fastify.post('/derive', async (request, reply) => {
    const body = deriveBodySchema.safeParse(request.body);
    if (!body.success) throw new ValidationError(body.error.issues[0]?.message ?? 'Dati non validi');

    const userId = request.user.sub;
    const derived = deriveGoals({ ...body.data, userId });

    // Delete existing derived goals and create new ones
    await fastify.prisma.goal.deleteMany({ where: { userId, derivedFrom: { not: null } } });

    const northId = Date.now().toString();
    const goals = [];

    for (let i = 0; i < derived.length; i++) {
      const g = derived[i];
      const id = `${northId}-${i}`;
      const saved = await fastify.prisma.goal.create({
        data: { id, userId, ...g, derivedFrom: i === 0 ? null : northId },
      });
      goals.push(saved);
    }

    return reply.send(goals);
  });
}
