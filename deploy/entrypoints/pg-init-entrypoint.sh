#!/bin/sh
# =============================================================================
# PostgreSQL Init Container Docker Secrets Entrypoint
# =============================================================================
# Exports PGPASSWORD from POSTGRES_PASSWORD secret file for psql commands.
# Used by umami-db-init and listmonk-db-init containers.
# =============================================================================

if [ -f /run/secrets/postgres_password ]; then
  export PGPASSWORD=$(cat /run/secrets/postgres_password | tr -d '\n')
fi

exec "$@"
