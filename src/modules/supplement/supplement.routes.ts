import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../../shared/middleware/auth';
import { supplementBodySchema, idParamSchema } from './supplement.schema';
import { upsertSupplement, deleteSupplement } from './supplement.service';
import { reminderBodySchema, reminderPatchSchema, idParamSchema as ridParamSchema } from './reminder.schema';
import { getReminders, upsertReminder, patchReminder, deleteReminder, takeReminder, untakeReminder } from './reminder.service';
import { ValidationError } from '../../shared/errors';

export async function supplementRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', requireAuth);

  // ── Supplement entries ────────────────────────────────────────────────────

  fastify.put('/:id', async (request, reply) => {
    const userId = request.user.sub;
    const paramsParsed = idParamSchema.safeParse(request.params);
    if (!paramsParsed.success) throw new ValidationError('ID non valido');
    const bodyParsed = supplementBodySchema.safeParse(request.body);
    if (!bodyParsed.success) throw new ValidationError(bodyParsed.error.issues[0]?.message ?? 'Dati non validi');
    const supplement = await upsertSupplement(fastify.prisma, userId, paramsParsed.data.id, bodyParsed.data);
    return reply.send(supplement);
  });

  fastify.delete('/:id', async (request, reply) => {
    const userId = request.user.sub;
    const parsed = idParamSchema.safeParse(request.params);
    if (!parsed.success) throw new ValidationError('ID non valido');
    await deleteSupplement(fastify.prisma, userId, parsed.data.id);
    return reply.status(204).send();
  });

  // ── Reminder CRUD ─────────────────────────────────────────────────────────

  fastify.get('/reminders', async (request, reply) => {
    const reminders = await getReminders(fastify.prisma, request.user.sub);
    return reply.send(reminders);
  });

  fastify.put('/reminders/:id', async (request, reply) => {
    const parsed = ridParamSchema.safeParse(request.params);
    if (!parsed.success) throw new ValidationError('ID non valido');
    const body = reminderBodySchema.safeParse(request.body);
    if (!body.success) throw new ValidationError(body.error.issues[0]?.message ?? 'Dati non validi');
    const r = await upsertReminder(fastify.prisma, request.user.sub, parsed.data.id, body.data);
    return reply.send(r);
  });

  fastify.patch('/reminders/:id', async (request, reply) => {
    const parsed = ridParamSchema.safeParse(request.params);
    if (!parsed.success) throw new ValidationError('ID non valido');
    const body = reminderPatchSchema.safeParse(request.body);
    if (!body.success) throw new ValidationError(body.error.issues[0]?.message ?? 'Dati non validi');
    const r = await patchReminder(fastify.prisma, request.user.sub, parsed.data.id, body.data);
    if (!r) return reply.status(404).send({ error: 'Not found' });
    return reply.send(r);
  });

  fastify.delete('/reminders/:id', async (request, reply) => {
    const parsed = ridParamSchema.safeParse(request.params);
    if (!parsed.success) throw new ValidationError('ID non valido');
    await deleteReminder(fastify.prisma, request.user.sub, parsed.data.id);
    return reply.status(204).send();
  });

  // ── Take / untake reminder today ──────────────────────────────────────────

  fastify.post('/reminders/:id/take', async (request, reply) => {
    const parsed = ridParamSchema.safeParse(request.params);
    if (!parsed.success) throw new ValidationError('ID non valido');
    const entry = await takeReminder(fastify.prisma, request.user.sub, parsed.data.id);
    if (!entry) return reply.status(404).send({ error: 'Reminder not found' });
    return reply.send(entry);
  });

  fastify.delete('/reminders/:id/take', async (request, reply) => {
    const parsed = ridParamSchema.safeParse(request.params);
    if (!parsed.success) throw new ValidationError('ID non valido');
    await untakeReminder(fastify.prisma, request.user.sub, parsed.data.id);
    return reply.status(204).send();
  });
}
