import type { FastifyRequest, FastifyReply } from 'fastify';

export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    await request.jwtVerify();
  } catch {
    // Send directly instead of throwing — Fastify v5 does not route errors from
    // preHandler hooks through setErrorHandler for DELETE routes.
    await reply.status(401).send({ code: 'UNAUTHORIZED', message: 'Autenticazione richiesta' });
  }
}
