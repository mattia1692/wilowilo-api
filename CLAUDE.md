# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Run locally (requires DATABASE_URL env var pointing to a PostgreSQL instance)
npm run dev

# Build
npm run build

# Deploy to Railway (production)
git push origin main   # Railway auto-deploys from main

# Database migrations (dev)
npm run db:migrate

# Generate Prisma client after schema changes
npm run db:generate
```

## Architecture

TypeScript + Fastify + Prisma backend deployed on Railway as `wilowilo-api`. Serves as the primary backend for the **wilowilo-pwa** app.

### Deployment

- **Platform**: Railway (project `wilowilo`, service `wilowilo-api`)
- **Database**: Railway PostgreSQL (service `wilowilo-db`, internal networking via `wilowilo-db.railway.internal:5432`)
- **On start**: `npx prisma migrate deploy && node dist/server.js` (Dockerfile CMD)
- Railway auto-deploys on push to `main`

### Environment variables required

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (set to internal Railway URL in prod) |
| `FIREBASE_API_KEY` | Verifies Firebase ID tokens via Google REST API |
| `ANTHROPIC_API_KEY` | Calls Claude for AI features |
| `JWT_ACCESS_SECRET` | Signs/verifies wilowilo access tokens (1h) |
| `JWT_REFRESH_SECRET` | Signs/verifies refresh tokens (30d, httpOnly cookie) |
| `COOKIE_SECRET` | Signs cookies |
| `WILO_FOODS_API_URL` | Base URL for wilo-foods-api (defaults to Railway URL) |
| `WILO_FOODS_API_KEY` | API key for wilo-foods-api (defaults to empty) |

### Module structure

```
src/
  server.ts            — entry point, creates and starts Fastify app
  app.ts               — plugin registration, /health, /init, /admin/migrate
  plugins/
    prisma.ts          — PrismaClient singleton on fastify.prisma
    auth.ts            — @fastify/jwt + @fastify/cookie
    cors.ts            — CORS allowlist
  modules/
    auth/              — POST /auth/login|refresh|logout (Firebase → JWT exchange)
    diary/             — POST /diary/items, DELETE /diary/items/:date/:meal/:idx, PATCH /diary/days/:date
    weight/            — PUT|DELETE /weight/:date, PUT|PATCH|DELETE /weight/checkpoints/:id
    settings/          — PATCH /settings
    foods/             — GET /food/search|search/extended|barcode/:barcode, POST /ai/*
  shared/
    errors/            — AppError hierarchy
    middleware/auth.ts — requireAuth preHandler (verifies JWT, populates request.user)
prisma/
  schema.prisma        — User, DiaryDay, UserSettings, WeightEntry, WeightCheckpoint, CustomFood
```

### Auth flow

1. Client sends Firebase ID token to `POST /auth/login`
2. Server verifies via `identitytoolkit.googleapis.com/v1/accounts:lookup` (no Firebase Admin SDK)
3. Upserts User in PostgreSQL
4. Returns access token (1h, `{ sub: uid, email }`) + sets httpOnly refresh cookie (30d)
5. On 401, client calls `POST /auth/refresh` (uses cookie) to get a new access token

### Key endpoint: GET /init

Returns all user data in one shot: `{ settings, today, history, weights, checkpoints, customFoods }`. Called by the PWA on boot to hydrate all stores.

### One-time migration endpoint: POST /admin/migrate

Enabled only when `MIGRATION_SECRET` env var is set. Accepts `{ uid, email, data: <Firebase tracker JSON> }` with `x-migration-secret` header. Used for one-time Firebase RTDB → PostgreSQL data migration.

### AI endpoints (POST /)

Legacy root endpoint for backward compat. Verifies Firebase token directly (no wilowilo-api session required). Rate limit: 30 req/hour per UID (in-memory, resets on restart).

AI routes under `/food`:
- `POST /ai/analyze` — macro breakdown of described meal
- `POST /ai/suggest` — meal suggestions for remaining macros
- `POST /ai/plan` — full day meal plan

### Food search

`GET /food/search?q=` proxies to wilo-foods-api and maps results to `OFFProduct` shape via `wfaToOff()`. Responses cached in-memory for 5 minutes.
