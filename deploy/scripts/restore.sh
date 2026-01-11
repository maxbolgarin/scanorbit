#!/bin/sh
# =============================================================================
# PostgreSQL Restore Script
# =============================================================================
# Restores encrypted backup from Scaleway Object Storage
# Usage: ./restore.sh <backup_file_name> or ./restore.sh --list
# =============================================================================

set -eu

BACKUP_DIR="/tmp/restore"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
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
    aws --endpoint-url "${S3_ENDPOINT}" s3 ls "s3://${SCW_BUCKET_NAME}/daily/" 2>/dev/null | grep ".sql.gz.gpg$" | tail -10 || echo "No daily backups found"
    echo ""
    echo "=== Weekly Backups (last 90 days) ==="
    aws --endpoint-url "${S3_ENDPOINT}" s3 ls "s3://${SCW_BUCKET_NAME}/weekly/" 2>/dev/null | grep ".sql.gz.gpg$" | tail -10 || echo "No weekly backups found"
    echo ""
    echo "=== Monthly Backups (last 365 days) ==="
    aws --endpoint-url "${S3_ENDPOINT}" s3 ls "s3://${SCW_BUCKET_NAME}/monthly/" 2>/dev/null | grep ".sql.gz.gpg$" | tail -10 || echo "No monthly backups found"
}

# Download and decrypt backup
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
            log "WARNING: Checksum verification failed!"
            read -p "Continue anyway? (y/N) " confirm
            [ "$confirm" != "y" ] && exit 1
        fi
        cd - >/dev/null
    fi

    log "Download complete"
}

# Decrypt and restore
restore_backup() {
    BACKUP_NAME="$1"

    log "Decrypting backup..."
    gpg --decrypt --batch --yes \
        --passphrase "${BACKUP_ENCRYPTION_KEY}" \
        "${BACKUP_DIR}/${BACKUP_NAME}" | \
        gunzip > "${BACKUP_DIR}/restore.sql"

    log "Restoring database..."
    log "WARNING: This will overwrite the existing database!"
    read -p "Are you sure you want to continue? (y/N) " confirm
    [ "$confirm" != "y" ] && exit 1

    # Restore to PostgreSQL
    PGPASSWORD="${PGPASSWORD}" psql -h "${PGHOST}" -U "${PGUSER}" -d "${PGDATABASE}" \
        -f "${BACKUP_DIR}/restore.sql"

    log "Restore complete!"
}

# Cleanup
cleanup() {
    log "Cleaning up temporary files..."
    rm -rf "${BACKUP_DIR}"
}

# Print usage
usage() {
    echo "Usage: $0 [--list | <backup_type>/<backup_filename>]"
    echo ""
    echo "Options:"
    echo "  --list                     List available backups"
    echo "  daily/<filename>           Restore a daily backup"
    echo "  weekly/<filename>          Restore a weekly backup"
    echo "  monthly/<filename>         Restore a monthly backup"
    echo ""
    echo "Example:"
    echo "  $0 --list"
    echo "  $0 daily/scanorbit_20240115_020000.sql.gz.gpg"
    echo ""
    echo "Required environment variables:"
    echo "  PGHOST, PGUSER, PGPASSWORD, PGDATABASE"
    echo "  SCW_ACCESS_KEY, SCW_SECRET_KEY, SCW_BUCKET_NAME, SCW_REGION"
    echo "  BACKUP_ENCRYPTION_KEY"
}

# Main
main() {
    # Install dependencies
    if ! command -v gpg >/dev/null 2>&1 || ! command -v aws >/dev/null 2>&1; then
        apk add --no-cache gnupg aws-cli
    fi

    setup_aws

    if [ $# -eq 0 ]; then
        usage
        exit 1
    fi

    case "$1" in
        --list|-l)
            list_backups
            ;;
        --help|-h)
            usage
            ;;
        *)
            log "=============================================="
            log "PostgreSQL Restore"
            log "=============================================="
            download_backup "$1"
            restore_backup "$(basename "$1")"
            cleanup
            log "=============================================="
            log "Restore completed successfully!"
            log "=============================================="
            ;;
    esac
}

main "$@"
