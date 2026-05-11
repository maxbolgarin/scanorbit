#!/bin/sh
# =============================================================================
# PostgreSQL Restore Script
# =============================================================================
# Restores encrypted backup from Scaleway Object Storage
# Usage: ./restore.sh <backup_type/backup_file_name>
#        ./restore.sh --list
#        ./restore.sh --verify <backup_type/backup_file_name>
# =============================================================================

set -eu

BACKUP_DIR="/tmp/restore"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Load secrets from Docker secret files
load_secrets() {
    [ -f /run/secrets/postgres_password ] && export PGPASSWORD=$(cat /run/secrets/postgres_password | tr -d '\n')
    [ -f /run/secrets/backup_encryption_key ] && export BACKUP_ENCRYPTION_KEY=$(cat /run/secrets/backup_encryption_key | tr -d '\n')
    [ -f /run/secrets/scw_access_key ] && export SCW_ACCESS_KEY=$(cat /run/secrets/scw_access_key | tr -d '\n')
    [ -f /run/secrets/scw_secret_key ] && export SCW_SECRET_KEY=$(cat /run/secrets/scw_secret_key | tr -d '\n')
}

# Configure AWS CLI for Scaleway
setup_aws() {
    export AWS_ACCESS_KEY_ID="${SCW_ACCESS_KEY}"
    export AWS_SECRET_ACCESS_KEY="${SCW_SECRET_KEY}"
    export AWS_DEFAULT_REGION="${SCW_REGION}"
    S3_ENDPOINT="https://s3.${SCW_REGION}.scw.cloud"
}

# List available backups
list_backups() {
    log "Available backups in s3://${SCW_BUCKET_NAME}:"
    echo ""
    echo "=== Daily Backups (last 30 days) ==="
    aws --endpoint-url "${S3_ENDPOINT}" s3 ls "s3://${SCW_BUCKET_NAME}/db/daily/" 2>/dev/null | grep ".sql.gz.gpg$" | tail -10 || echo "No daily backups found"
    echo ""
    echo "=== Weekly Backups (last 90 days) ==="
    aws --endpoint-url "${S3_ENDPOINT}" s3 ls "s3://${SCW_BUCKET_NAME}/db/weekly/" 2>/dev/null | grep ".sql.gz.gpg$" | tail -10 || echo "No weekly backups found"
    echo ""
    echo "=== Monthly Backups (last 365 days) ==="
    aws --endpoint-url "${S3_ENDPOINT}" s3 ls "s3://${SCW_BUCKET_NAME}/db/monthly/" 2>/dev/null | grep ".sql.gz.gpg$" | tail -10 || echo "No monthly backups found"
}

# Download backup from S3
download_backup() {
    BACKUP_PATH="$1"
    BACKUP_NAME=$(basename "${BACKUP_PATH}")

    log "Downloading backup: ${BACKUP_PATH}..."
    mkdir -p "${BACKUP_DIR}"

    # Download backup file
    aws --endpoint-url "${S3_ENDPOINT}" s3 cp \
        "s3://${SCW_BUCKET_NAME}/${BACKUP_PATH}" \
        "${BACKUP_DIR}/${BACKUP_NAME}"

    # Download checksum if available
    aws --endpoint-url "${S3_ENDPOINT}" s3 cp \
        "s3://${SCW_BUCKET_NAME}/${BACKUP_PATH}.sha256" \
        "${BACKUP_DIR}/${BACKUP_NAME}.sha256" 2>/dev/null || true

    # Verify checksum if available
    if [ -f "${BACKUP_DIR}/${BACKUP_NAME}.sha256" ]; then
        log "Verifying checksum..."
        cd "${BACKUP_DIR}"
        if sha256sum -c "${BACKUP_NAME}.sha256" >/dev/null 2>&1; then
            log "Checksum verified successfully"
        else
            log "ERROR: Checksum verification failed! Aborting."
            cd - >/dev/null
            return 1
        fi
        cd - >/dev/null
    fi

    log "Download complete"
}

# Decrypt backup to SQL
decrypt_backup() {
    BACKUP_NAME="$1"

    log "Decrypting backup..."
    gpg --decrypt --batch --yes \
        --passphrase "${BACKUP_ENCRYPTION_KEY}" \
        "${BACKUP_DIR}/${BACKUP_NAME}" | \
        gunzip > "${BACKUP_DIR}/restore.sql"

    SQL_SIZE=$(du -h "${BACKUP_DIR}/restore.sql" | cut -f1)
    log "Decrypted SQL dump: ${SQL_SIZE}"

    # Validate it's a real pg dump
    if ! head -5 "${BACKUP_DIR}/restore.sql" | grep -q "PostgreSQL database dump"; then
        log "ERROR: Decrypted file does not look like a PostgreSQL dump!"
        return 1
    fi
}

# Verify backup without restoring
verify_only() {
    BACKUP_PATH="$1"
    BACKUP_NAME=$(basename "${BACKUP_PATH}")

    log "=============================================="
    log "PostgreSQL Backup Verification"
    log "=============================================="

    download_backup "${BACKUP_PATH}"
    decrypt_backup "${BACKUP_NAME}"

    # Count tables and statements
    TABLE_COUNT=$(grep -c "^CREATE TABLE" "${BACKUP_DIR}/restore.sql" 2>/dev/null || echo "0")
    INSERT_COUNT=$(grep -c "^INSERT INTO\|^COPY .* FROM stdin" "${BACKUP_DIR}/restore.sql" 2>/dev/null || echo "0")

    log "Backup content summary:"
    log "  Tables: ${TABLE_COUNT}"
    log "  Data statements: ${INSERT_COUNT}"
    log "Backup is valid and can be restored."

    cleanup
    log "=============================================="
}

# Restore backup to database
restore_backup() {
    BACKUP_NAME="$1"

    log "Restoring database..."
    log "Target: ${PGHOST}:${PGDATABASE} as ${PGUSER}"

    # Build psql connection args
    PSQL_ARGS="-h ${PGHOST} -U ${PGUSER} -d ${PGDATABASE}"
    if [ "${PGSSLMODE:-}" = "require" ] && [ -n "${PGSSLROOTCERT:-}" ]; then
        PSQL_ARGS="${PSQL_ARGS} --set=sslmode=require --set=sslrootcert=${PGSSLROOTCERT}"
    fi

    # Use --single-transaction for atomic restore (all or nothing)
    psql ${PSQL_ARGS} --single-transaction -f "${BACKUP_DIR}/restore.sql"

    log "Restore complete!"
}

# Cleanup
cleanup() {
    log "Cleaning up temporary files..."
    rm -rf "${BACKUP_DIR}"
}

# Print usage
usage() {
    echo "Usage: $0 [--list | --verify <path> | <backup_type>/<backup_filename>]"
    echo ""
    echo "Options:"
    echo "  --list                     List available backups"
    echo "  --verify <path>            Verify a backup can be decrypted without restoring"
    echo "  daily/<filename>           Restore a daily backup"
    echo "  weekly/<filename>          Restore a weekly backup"
    echo "  monthly/<filename>         Restore a monthly backup"
    echo ""
    echo "Examples:"
    echo "  $0 --list"
    echo "  $0 --verify db/daily/scanorbit_20240115_020000.sql.gz.gpg"
    echo "  $0 db/daily/scanorbit_20240115_020000.sql.gz.gpg"
    echo ""
    echo "Required environment variables (or Docker secrets):"
    echo "  PGHOST, PGUSER, PGDATABASE"
    echo "  SCW_BUCKET_NAME, SCW_REGION"
    echo ""
    echo "Run inside Docker:"
    echo "  docker compose -f docker-compose.yml run --rm db-restore --list"
    echo "  docker compose -f docker-compose.yml run --rm db-restore --verify db/daily/<file>"
    echo "  docker compose -f docker-compose.yml run --rm db-restore db/daily/<file>"
}

# Main
main() {
    # Install dependencies
    if ! command -v gpg >/dev/null 2>&1 || ! command -v aws >/dev/null 2>&1; then
        apk add --no-cache gnupg aws-cli
    fi

    load_secrets
    setup_aws

    if [ $# -eq 0 ]; then
        usage
        exit 1
    fi

    case "$1" in
        --list|-l)
            list_backups
            ;;
        --verify|-v)
            [ $# -lt 2 ] && { echo "Error: --verify requires a backup path"; usage; exit 1; }
            verify_only "$2"
            ;;
        --help|-h)
            usage
            ;;
        *)
            log "=============================================="
            log "PostgreSQL Restore"
            log "=============================================="
            download_backup "$1"
            decrypt_backup "$(basename "$1")"
            restore_backup "$(basename "$1")"
            cleanup
            log "=============================================="
            log "Restore completed successfully!"
            log "=============================================="
            ;;
    esac
}

main "$@"
