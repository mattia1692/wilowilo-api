import type { FastifyInstance } from 'fastify';
import { loginBodySchema } from './auth.schema';
import {
  verifyFirebaseToken,
  loginOrRegister,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  getUserById,
  getRefreshCookieName,
  getRefreshCookieOptions,
  maybeMigrateFromFirebase,
} from './auth.service';
import { UnauthorizedError, ValidationError } from '../../shared/errors';

export async function authRoutes(fastify: FastifyInstance) {
  // POST /auth/login — verifica Firebase token, emette JWT
  fastify.post('/login', async (request, reply) => {
    const parsed = loginBodySchema.safeParse(request.body);
    if (!parsed.success) throw new ValidationError('firebaseToken richiesto');

    const fbUser = await verifyFirebaseToken(parsed.data.firebaseToken);
    const user = await loginOrRegister(fastify.prisma, fbUser);

    // Best-effort: migrate Firebase RTDB data on first login (no-op if already done or FIREBASE_DB_URL not set)
    void maybeMigrateFromFirebase(fastify.prisma, user.id, parsed.data.firebaseToken);

    const accessToken = signAccessToken({ sub: user.id, email: user.email });
    const refreshToken = signRefreshToken({ sub: user.id });

    reply.setCookie(getRefreshCookieName(), refreshToken, getRefreshCookieOptions());

    return reply.send({
      accessToken,
      user: { id: user.id, email: user.email },
    });
  });

  // POST /auth/refresh — rinnova access token via httpOnly cookie
  fastify.post('/refresh', async (request, reply) => {
    const token = request.cookies[getRefreshCookieName()];
    if (!token) throw new UnauthorizedError('Refresh token mancante');

    const payload = verifyRefreshToken(token);
    const user = await getUserById(fastify.prisma, payload.sub);
    if (!user) throw new UnauthorizedError('Utente non trovato');

    const accessToken = signAccessToken({ sub: user.id, email: user.email });
    return reply.send({ accessToken });
  });

  // POST /auth/logout — cancella cookie
  fastify.post('/logout', async (request, reply) => {
    reply.clearCookie(getRefreshCookieName(), { path: '/' });
    return reply.status(204).send();
  });
}
