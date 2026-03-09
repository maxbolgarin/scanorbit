#!/bin/sh
# =============================================================================
# PostgreSQL Backup Docker Secrets Entrypoint
# =============================================================================
# Exports PGPASSWORD, BACKUP_ENCRYPTION_KEY, SCW_ACCESS_KEY, SCW_SECRET_KEY
# from Docker secret files, then starts crond.
# =============================================================================

if [ -f /run/secrets/postgres_password ]; then
  export PGPASSWORD=$(cat /run/secrets/postgres_password | tr -d '\n')
fi

if [ -f /run/secrets/backup_encryption_key ]; then
  export BACKUP_ENCRYPTION_KEY=$(cat /run/secrets/backup_encryption_key | tr -d '\n')
fi

if [ -f /run/secrets/scw_access_key ]; then
  export SCW_ACCESS_KEY=$(cat /run/secrets/scw_access_key | tr -d '\n')
fi

if [ -f /run/secrets/scw_secret_key ]; then
  export SCW_SECRET_KEY=$(cat /run/secrets/scw_secret_key | tr -d '\n')
fi

exec "$@"
