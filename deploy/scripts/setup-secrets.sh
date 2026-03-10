#!/bin/sh
# =============================================================================
# ScanOrbit Docker Secrets Setup
# =============================================================================
# Creates secret files for Docker Compose from user input.
# Run once on the production server, then remove this file.
#
# Usage:
#   ./setup-secrets.sh              # Interactive mode (prompts for each value)
#   ./setup-secrets.sh secrets.env  # Read from file (KEY=VALUE format)
#
# The secrets.env file format (one secret per line):
#   POSTGRES_PASSWORD=your_password_here
#   JWT_SECRET=your_jwt_secret_here
#   ...
#
# After running, remove secrets.env: rm -f secrets.env
# =============================================================================

set -eu

SECRETS_DIR="$(cd "$(dirname "$0")/.." && pwd)/secrets"

# All secrets to create
SECRETS="
postgres_password:POSTGRES_PASSWORD:PostgreSQL admin password
so_api_password:SO_API_PASSWORD:so_api user password (openssl rand -hex 32)
so_api_database_url:SO_API_DATABASE_URL:API database URL (postgresql://so_api:PASS@postgres:5432/scanorbit?sslmode=require)
so_migrate_password:SO_MIGRATE_PASSWORD:so_migrate user password (openssl rand -hex 32)
so_migrate_database_url:SO_MIGRATE_DATABASE_URL:Migrate database URL (postgresql://so_migrate:PASS@postgres:5432/scanorbit?sslmode=require)
so_scanner_password:SO_SCANNER_PASSWORD:so_scanner user password (openssl rand -hex 32)
so_scanner_database_url:SO_SCANNER_DATABASE_URL:Scanner database URL (postgresql://so_scanner:PASS@postgres:5432/scanorbit?sslmode=require)
so_analyzer_password:SO_ANALYZER_PASSWORD:so_analyzer user password (openssl rand -hex 32)
so_analyzer_database_url:SO_ANALYZER_DATABASE_URL:Analyzer database URL (postgresql://so_analyzer:PASS@postgres:5432/scanorbit?sslmode=require)
so_backup_password:SO_BACKUP_PASSWORD:so_backup user password (openssl rand -hex 32)
so_exporter_password:SO_EXPORTER_PASSWORD:so_exporter user password (openssl rand -hex 32)
so_umami_password:SO_UMAMI_PASSWORD:so_umami user password (openssl rand -hex 32)
so_listmonk_password:SO_LISTMONK_PASSWORD:so_listmonk user password (openssl rand -hex 32)
redis_password:REDIS_PASSWORD:Redis password
redis_url:REDIS_URL:Redis connection URL (rediss://:pass@redis:6379)
jwt_secret:JWT_SECRET:JWT access token secret (openssl rand -hex 32)
jwt_refresh_secret:JWT_REFRESH_SECRET:JWT refresh token secret (openssl rand -hex 32)
totp_encryption_key:TOTP_ENCRYPTION_KEY:TOTP encryption key (openssl rand -hex 32)
oauth_encryption_key:OAUTH_ENCRYPTION_KEY:OAuth encryption key (openssl rand -hex 32)
google_client_secret:GOOGLE_CLIENT_SECRET:Google OAuth client secret
github_client_secret:GITHUB_CLIENT_SECRET:GitHub OAuth client secret
stripe_secret_key:STRIPE_SECRET_KEY:Stripe secret key
stripe_webhook_secret:STRIPE_WEBHOOK_SECRET:Stripe webhook secret
aws_access_key_id:AWS_ACCESS_KEY_ID:AWS access key ID
aws_secret_access_key:AWS_SECRET_ACCESS_KEY:AWS secret access key
backup_encryption_key:BACKUP_ENCRYPTION_KEY:Backup encryption key (openssl rand -hex 32)
scw_access_key:SCW_ACCESS_KEY:Scaleway access key
scw_secret_key:SCW_SECRET_KEY:Scaleway secret key
smtp_pass:SMTP_PASS:SMTP password
"

log() {
  echo "[setup-secrets] $1"
}

# Create secrets directory
mkdir -p "$SECRETS_DIR"
chmod 700 "$SECRETS_DIR"
log "Secrets directory: $SECRETS_DIR"

# Check if reading from file
INPUT_FILE="${1:-}"
if [ -n "$INPUT_FILE" ] && [ -f "$INPUT_FILE" ]; then
  log "Reading secrets from: $INPUT_FILE"
  log ""

  echo "$SECRETS" | while IFS=: read -r file_name env_name description; do
    [ -z "$file_name" ] && continue

    # Extract value from input file
    value=$(grep "^${env_name}=" "$INPUT_FILE" 2>/dev/null | head -1 | cut -d'=' -f2-)

    if [ -n "$value" ]; then
      printf '%s' "$value" > "$SECRETS_DIR/$file_name"
      chmod 644 "$SECRETS_DIR/$file_name"
      log "  Created: $file_name"
    else
      log "  SKIPPED: $file_name (not found in input file)"
    fi
  done

else
  log "Interactive mode - enter each secret value (empty to skip)"
  log ""

  echo "$SECRETS" | while IFS=: read -r file_name env_name description; do
    [ -z "$file_name" ] && continue

    printf "  %s\n    %s: " "$description" "$env_name"
    read -r value

    if [ -n "$value" ]; then
      printf '%s' "$value" > "$SECRETS_DIR/$file_name"
      chmod 644 "$SECRETS_DIR/$file_name"
      log "  Created: $file_name"
    else
      log "  SKIPPED: $file_name"
    fi
  done
fi

log ""
log "=============================================="
log "Secrets setup complete!"
log ""
log "Created files:"
ls -la "$SECRETS_DIR/" 2>/dev/null || log "  (none)"
log ""
log "Next steps:"
log "  1. Remove secret values from .env.prod (keep non-sensitive config only)"
log "  2. If you used a secrets.env file, delete it: rm -f $INPUT_FILE"
log "  3. Restart services: docker compose -f docker-compose.prod.yml up -d"
log "  4. Verify: docker inspect api | grep -A5 Env  (should show NO secrets)"
log "=============================================="
