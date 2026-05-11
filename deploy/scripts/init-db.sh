#!/bin/sh
# =============================================================================
# ScanOrbit — Unified Database Initialization (Docker Container)
# =============================================================================
# Runs inside a postgres:17-alpine container as a Docker Compose service.
# Reads passwords from /run/secrets/ (Docker secret mounts), substitutes
# them into init-db.sql, and executes against PostgreSQL.
#
# Idempotent — safe to re-run on every `docker compose up`.
#
# The Drizzle migrate service runs after this and auto-syncs migration
# tracking (it detects existing tables and marks migrations as applied).
# =============================================================================

set -eu

SQL_FILE="/scripts/init-db.sql"

log() {
  echo "[init-db] $1"
}

read_secret() {
  file="/run/secrets/$1"
  if [ -f "$file" ]; then
    cat "$file" | tr -d '\n'
  else
    echo ""
  fi
}

# =============================================================================
# 1. Read passwords from Docker secrets
# =============================================================================

log "Reading passwords from /run/secrets/..."

ADMIN_PASS=$(read_secret "postgres_password")
MIGRATE_PASS=$(read_secret "so_migrate_password")
API_PASS=$(read_secret "so_api_password")
SCANNER_PASS=$(read_secret "so_scanner_password")
ANALYZER_PASS=$(read_secret "so_analyzer_password")
BACKUP_PASS=$(read_secret "so_backup_password")
EXPORTER_PASS=$(read_secret "so_exporter_password")
UMAMI_PASS=$(read_secret "so_umami_password")

# Validate required passwords
for secret in postgres_password so_migrate_password so_api_password so_scanner_password \
              so_analyzer_password so_backup_password so_exporter_password \
              so_umami_password; do
  val=$(read_secret "$secret")
  if [ -z "$val" ]; then
    log "ERROR: Missing secret: /run/secrets/$secret"
    exit 1
  fi
done

# =============================================================================
# 2. Substitute passwords into SQL and execute
# =============================================================================

log "Running init-db.sql against PostgreSQL..."

export PGPASSWORD="$ADMIN_PASS"

sed \
  -e "s|__SO_MIGRATE_PASS__|${MIGRATE_PASS}|g" \
  -e "s|__SO_API_PASS__|${API_PASS}|g" \
  -e "s|__SO_SCANNER_PASS__|${SCANNER_PASS}|g" \
  -e "s|__SO_ANALYZER_PASS__|${ANALYZER_PASS}|g" \
  -e "s|__SO_BACKUP_PASS__|${BACKUP_PASS}|g" \
  -e "s|__SO_EXPORTER_PASS__|${EXPORTER_PASS}|g" \
  -e "s|__SO_UMAMI_PASS__|${UMAMI_PASS}|g" \
  "$SQL_FILE" | psql -h postgres -U scanorbit -d postgres -v ON_ERROR_STOP=1

# =============================================================================
# Done
# =============================================================================

log ""
log "=============================================="
log "Database initialization completed!"
log ""
log "Created:"
log "  Databases: scanorbit, umami"
log "  Users: so_migrate, so_api, so_scanner, so_analyzer,"
log "         so_backup, so_exporter, so_umami"
log "  Schema: 24 tables with indexes and foreign keys"
log "  Grants: per-service least-privilege access"
log "=============================================="
