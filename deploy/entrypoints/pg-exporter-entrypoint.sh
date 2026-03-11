#!/bin/sh
# =============================================================================
# PostgreSQL Exporter Docker Secrets Entrypoint
# =============================================================================
# Constructs DATA_SOURCE_NAME from POSTGRES_PASSWORD secret file.
# =============================================================================

if [ -f /run/secrets/postgres_password ]; then
  PG_PASS=$(cat /run/secrets/postgres_password | tr -d '\n')
  export DATA_SOURCE_NAME="postgresql://${POSTGRES_USER:-scanorbit}:${PG_PASS}@postgres:5432/${POSTGRES_DB:-scanorbit}?sslmode=require&sslrootcert=/certs/ca.crt"
fi

exec /bin/postgres_exporter "$@"
