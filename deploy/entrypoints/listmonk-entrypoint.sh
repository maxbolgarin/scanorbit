#!/bin/sh
# =============================================================================
# Listmonk Docker Secrets Entrypoint
# =============================================================================
# Exports LISTMONK_db__password and LISTMONK_app__admin_password from secret files.
# =============================================================================

if [ -f /run/secrets/postgres_password ]; then
  export LISTMONK_db__password=$(cat /run/secrets/postgres_password | tr -d '\n')
fi

exec "$@"
