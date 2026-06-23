import type { FastifyInstance } from 'fastify';
import { exerciseListQuerySchema, exerciseSlugParamSchema, exerciseMatchQuerySchema } from './exercises.schema';
import { listExercises, getExerciseBySlug, getExerciseMatchIndex } from './exercises.service';

export async function exerciseRoutes(fastify: FastifyInstance) {
  fastify.get('/', async (request, reply) => {
    const parsed = exerciseListQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid query params' });

    const result = await listExercises(fastify.prisma, parsed.data);
    reply.header('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
    return reply.send(result);
  });

  fastify.get('/match', async (request, reply) => {
    const parsed = exerciseMatchQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid query params' });

    const index = await getExerciseMatchIndex(fastify.prisma, parsed.data.lang);
    reply.header('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
    return reply.send(index);
  });

  fastify.get('/:slug', async (request, reply) => {
    const paramsParsed = exerciseSlugParamSchema.safeParse(request.params);
    if (!paramsParsed.success) return reply.status(400).send({ error: 'Invalid slug' });

    const lang = (request.query as any)?.lang || 'it';
    const exercise = await getExerciseBySlug(fastify.prisma, paramsParsed.data.slug, lang);
    if (!exercise) return reply.status(404).send({ error: 'Exercise not found' });

    reply.header('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
    return reply.send(exercise);
  });
}
