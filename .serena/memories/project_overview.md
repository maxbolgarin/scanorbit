# ScanOrbit Project Overview

## Purpose
ScanOrbit is an Agentless AWS Infrastructure Scanner SaaS application.

## Tech Stack
- **Monorepo**: pnpm workspaces with Turborepo
- **API (apps/api)**: Hono (Node.js), Drizzle ORM, PostgreSQL, Redis, TypeScript
- **Frontend (apps/app)**: React 19, Vite, TanStack Query, Zustand, Tailwind CSS, shadcn/ui (Radix)
- **Landing (apps/landing)**: Astro
- **Workers**: Background job processing

## Project Structure
```
apps/
  api/      - Backend API (Hono + Drizzle + PostgreSQL)
  app/      - Frontend SPA (React + Vite + Tailwind)
  landing/  - Marketing site (Astro)
packages/   - Shared packages
workers/    - Background workers
```

## Node/Package Requirements
- Node.js >= 24.0.0
- pnpm >= 9.0.0
