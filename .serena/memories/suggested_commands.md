# Suggested Commands

## Development
- `pnpm dev` - Run all apps in development mode
- `pnpm dev:api` - Run API only
- `pnpm dev:app` - Run frontend only
- `pnpm dev:landing` - Run landing page only

## Build
- `pnpm build` - Build all apps
- `pnpm build:api` - Build API
- `pnpm build:app` - Build frontend

## Database
- `pnpm db:generate` - Generate Drizzle migrations
- `pnpm db:migrate` - Run migrations
- `pnpm db:reset` - Reset database
- `pnpm --filter @scanorbit/api db:studio` - Open Drizzle Studio

## Quality
- `pnpm lint` - Run ESLint
- `pnpm typecheck` - Run TypeScript type checking
- `pnpm test` - Run tests

## Cleanup
- `pnpm clean` - Clean all build artifacts and node_modules
