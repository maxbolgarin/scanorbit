#!/bin/sh
# =============================================================================
# Umami Docker Secrets Entrypoint
# =============================================================================
# Constructs DATABASE_URL from POSTGRES_PASSWORD secret file.
# =============================================================================

if [ -f /run/secrets/postgres_password ]; then
  PG_PASS=$(cat /run/secrets/postgres_password | tr -d '\n')
  export DATABASE_URL="postgresql://${POSTGRES_USER:-scanorbit}:${PG_PASS}@postgres:5432/umami?sslmode=require"
fi

# Run Prisma migrations (creates tables on first start, no-op afterwards)
npx prisma migrate deploy

exec node server.js "$@"
