# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

ScanOrbit — agentless AWS infrastructure scanner. Open-source (Apache 2.0), self-hosted via Docker Compose. pnpm monorepo with Turbo.

## Commands

```bash
# Setup
make setup                    # install deps + start infra + migrate
make dev-infra                # start PostgreSQL (15432) + Redis (16379)

# Development
make dev                      # all TS apps via Turbo
make dev-api                  # API only (tsx watch)
make dev-app                  # React app only (Vite)

# Build
pnpm build                    # all apps
pnpm --filter @scanorbit/api build   # API only (tsc → dist/)

# Test (API — Vitest)
pnpm --filter @scanorbit/api test              # run all tests
pnpm --filter @scanorbit/api test -- src/test/services/authService.test.ts  # single file
pnpm --filter @scanorbit/api test:watch        # watch mode
pnpm --filter @scanorbit/api test:coverage     # with coverage

# Lint & Typecheck
pnpm lint                     # ESLint across all apps
pnpm typecheck                # tsc --noEmit across all apps

# Database (Drizzle ORM)
pnpm db:migrate               # run migrations
pnpm db:generate              # generate migrations from schema changes
make db-studio                # open Drizzle Studio GUI

# Go workers
cd workers && make test       # Go tests
cd workers && make lint       # golangci-lint
```

## Architecture

### Monorepo Layout

- **`apps/api`** — Hono.js backend (Node.js 24+, TypeScript strict). Entry: `src/index.ts`
- **`apps/app`** — React 19 frontend (Vite, Tailwind CSS 4, Radix UI, Zustand, React Query)
- **`workers/`** — Go services: `scanner` (AWS resource discovery) and `analyzer` (security/cost analysis)
- **`packages/eslint-config`** — shared ESLint configs (base, react)

### API Structure (`apps/api/src/`)

Routes mount at root level (e.g., `/auth`, `/orgs`, `/aws/accounts`) — see `routes/index.ts`. Public API lives at `/api/v1` with API key auth.

Services are **ES module singletons** — no DI framework. Each service file exports functions directly.

Key layers:
- `routes/` — Hono route handlers with Zod validation (`@hono/zod-validator`)
- `services/` — business logic (auth, stripe, AWS accounts, email, GDPR, etc.)
- `middlewares/` — auth (JWT via jose), rate limiting, audit logging, metrics, request IDs
- `db/schema.ts` — full Drizzle ORM schema (PostgreSQL)
- `db/migrations/` — auto-generated SQL migrations (drizzle-kit)
- `lib/` — config, logger, metrics (prom-client), Redis client, secrets reader
- `types/` — shared TypeScript types including subscription tier limits

### Auth Model

JWT access tokens (5min) + refresh tokens (7d, httpOnly cookies). OAuth via Google/GitHub. Optional 2FA (TOTP). Encryption keys for TOTP and OAuth tokens are AES-256 (32-byte hex).

### Subscription Tiers

`TIER_LIMITS` (FREE / PRO / TEAM) lives in `types/index.ts` for historical reasons. The OSS build hard-codes every org to the TEAM tier in `services/orgService.getOrgTier`; the Stripe routes are not mounted.

### Testing Patterns (API)

- Vitest with `pool: 'forks'`, tests in `src/test/`
- Module mocking: `vi.mock()` with `vi.hoisted()` for hoisted mock variables
- **`vi.clearAllMocks()` does NOT reset `.mockImplementation()`** — manually restore implementations in `beforeEach`
- Drizzle chain mocking: use `createChain()` from `src/test/helpers/mockDb.ts`
- Test setup in `src/test/setup.ts` pre-configures env vars and test IDs

### Infrastructure

- PostgreSQL 17 + Redis 7 (docker-compose at the repo root for both dev and self-hosted production).
- Self-hosted: a single `docker compose up -d` brings up db, redis, migrate, api, app, scanner, analyzer.
- Secrets in production: env vars from `.env` (or Docker secrets at `/run/secrets/` — read via `lib/secrets.ts`).
- GDPR: audit logging, data retention policies, consent tracking, deletion requests.

### Frontend (`apps/app`)

React Router for routing. Zustand for global state. React Query for server state. Axios for API calls. Component library built on Radix UI primitives with Tailwind CSS 4.

### Validation

Zod v4 throughout — route input validation via `@hono/zod-validator`, form validation in frontend via `@hookform/resolvers`.
