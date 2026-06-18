import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import fastifyCors from '@fastify/cors';

const ALLOWED_ORIGINS = [
  'https://macro-pwa.pages.dev',
  'https://wilowilo.pages.dev',
  'https://wilowilo-pwa.pages.dev',
  'https://www.wilowilo.com',
  'http://localhost:5173',
  'http://localhost:4173',
  'https://localhost',   // Capacitor Android (androidScheme: https)
];

const corsPlugin: FastifyPluginAsync = fp(async (fastify) => {
  await fastify.register(fastifyCors, {
    origin: (origin, cb) => {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        cb(null, true);
      } else {
        cb(new Error('Not allowed by CORS'), false);
      }
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });
});

export default corsPlugin;
