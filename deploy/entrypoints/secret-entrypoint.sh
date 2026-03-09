#!/bin/sh
# =============================================================================
# Generic Docker Secrets Entrypoint
# =============================================================================
# Reads all files from /run/secrets/ and exports them as uppercase environment
# variables, then exec's the original command.
# Example: /run/secrets/postgres_password -> POSTGRES_PASSWORD=<file contents>
# =============================================================================

for secret_file in /run/secrets/*; do
  if [ -f "$secret_file" ]; then
    secret_name=$(basename "$secret_file")
    var_name=$(echo "$secret_name" | tr '[:lower:]' '[:upper:]')
    export "$var_name"="$(cat "$secret_file" | tr -d '\n')"
  fi
done

exec "$@"
