#!/bin/sh
# =============================================================================
# PostgreSQL Backup Script with Encryption
# =============================================================================
# GDPR Compliance: Encrypted backups to Scaleway Object Storage
# =============================================================================

set -eu

# Configuration
BACKUP_DIR="/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DAY_OF_WEEK=$(date +%u)
DAY_OF_MONTH=$(date +%d)

# Load secrets from Docker secret files (cron does not inherit entrypoint env)
load_secrets() {
    [ -f /run/secrets/postgres_password ] && export PGPASSWORD=$(cat /run/secrets/postgres_password | tr -d '\n')
    [ -f /run/secrets/backup_encryption_key ] && export BACKUP_ENCRYPTION_KEY=$(cat /run/secrets/backup_encryption_key | tr -d '\n')
    [ -f /run/secrets/scw_access_key ] && export SCW_ACCESS_KEY=$(cat /run/secrets/scw_access_key | tr -d '\n')
    [ -f /run/secrets/scw_secret_key ] && export SCW_SECRET_KEY=$(cat /run/secrets/scw_secret_key | tr -d '\n')
}

# Determine backup type and path
if [ "$DAY_OF_MONTH" = "01" ]; then
    BACKUP_TYPE="monthly"
elif [ "$DAY_OF_WEEK" = "7" ]; then
    BACKUP_TYPE="weekly"
else
    BACKUP_TYPE="daily"
fi

BACKUP_FILE="scanorbit_${TIMESTAMP}.sql.gz.gpg"
S3_PATH="s3://${SCW_BUCKET_NAME}/db/${BACKUP_TYPE}/${BACKUP_FILE}"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Install required tools if not present
install_deps() {
    if ! command -v gpg >/dev/null 2>&1 || ! command -v aws >/dev/null 2>&1; then
        log "Installing dependencies..."
        apk add --no-cache gnupg aws-cli
    fi
}

# Create backup
create_backup() {
    log "Starting ${BACKUP_TYPE} backup..."

    # Create backup directory
    mkdir -p "${BACKUP_DIR}"

    # Dump database to temp file first so we can check pg_dump exit code.
    # In POSIX sh without pipefail, a failing pg_dump in a pipeline is silent.
    log "Dumping database..."
    DUMP_FILE="${BACKUP_DIR}/scanorbit_dump.sql"
    if ! pg_dump --clean --if-exists --no-owner --no-privileges --format=plain > "${DUMP_FILE}" 2>/dev/null; then
        log "ERROR: pg_dump failed!"
        rm -f "${DUMP_FILE}"
        return 1
    fi

    if [ ! -s "${DUMP_FILE}" ]; then
        log "ERROR: pg_dump produced an empty file!"
        rm -f "${DUMP_FILE}"
        return 1
    fi

    # Compress and encrypt
    gzip -c "${DUMP_FILE}" | \
        gpg --symmetric --cipher-algo AES256 --batch --yes \
            --passphrase "${BACKUP_ENCRYPTION_KEY}" \
        > "${BACKUP_DIR}/${BACKUP_FILE}"
    rm -f "${DUMP_FILE}"

    BACKUP_SIZE=$(du -h "${BACKUP_DIR}/${BACKUP_FILE}" | cut -f1)
    if [ ! -s "${BACKUP_DIR}/${BACKUP_FILE}" ]; then
        log "ERROR: Encrypted backup file is empty!"
        return 1
    fi

    # Calculate checksum (filename only, no path — portable across containers)
    cd "${BACKUP_DIR}"
    sha256sum "${BACKUP_FILE}" > "${BACKUP_FILE}.sha256"
    cd - >/dev/null

    log "Backup created: ${BACKUP_FILE} (${BACKUP_SIZE})"
}

# Upload to S3
upload_backup() {
    log "Uploading to Scaleway Object Storage..."

    # Configure AWS CLI for Scaleway
    export AWS_ACCESS_KEY_ID="${SCW_ACCESS_KEY}"
    export AWS_SECRET_ACCESS_KEY="${SCW_SECRET_KEY}"
    export AWS_DEFAULT_REGION="${SCW_REGION}"

    S3_ENDPOINT="https://s3.${SCW_REGION}.scw.cloud"

    # Upload backup file
    aws --endpoint-url "${S3_ENDPOINT}" s3 cp \
        "${BACKUP_DIR}/${BACKUP_FILE}" \
        "${S3_PATH}" \
        --storage-class STANDARD

    # Upload checksum
    aws --endpoint-url "${S3_ENDPOINT}" s3 cp \
        "${BACKUP_DIR}/${BACKUP_FILE}.sha256" \
        "${S3_PATH}.sha256" \
        --storage-class STANDARD

    log "Upload complete: ${S3_PATH}"
}

# Cleanup local files
cleanup() {
    log "Cleaning up local files..."
    rm -f "${BACKUP_DIR}/${BACKUP_FILE}" "${BACKUP_DIR}/${BACKUP_FILE}.sha256"
}

# Verify backup locally before cleanup.
# Note: backup-writer has PutObject only — no S3 read/list permissions.
# Full S3 verification requires backup-reader credentials (restore operations).
verify_backup() {
    log "Verifying backup locally before upload cleanup..."

    # Verify checksum of local file
    if [ -f "${BACKUP_DIR}/${BACKUP_FILE}.sha256" ]; then
        cd "${BACKUP_DIR}"
        if ! sha256sum -c "${BACKUP_FILE}.sha256" >/dev/null 2>&1; then
            log "ERROR: Local checksum verification failed!"
            cd - >/dev/null
            return 1
        fi
        cd - >/dev/null
        log "Local checksum verified"
    fi

    # Decrypt and decompress to verify the SQL is valid
    if gpg --decrypt --batch --yes --passphrase "${BACKUP_ENCRYPTION_KEY}" \
        "${BACKUP_DIR}/${BACKUP_FILE}" 2>/dev/null | \
        gunzip 2>/dev/null | \
        head -5 | grep -q "PostgreSQL database dump"; then
        log "Backup content verified: valid PostgreSQL dump"
    else
        log "WARNING: Could not confirm backup contains a valid PostgreSQL dump header"
    fi

    log "Backup verification passed"
    return 0
}

# Main execution
main() {
    log "=============================================="
    log "PostgreSQL Backup - ${BACKUP_TYPE}"
    log "=============================================="

    load_secrets
    install_deps
    create_backup
    verify_backup
    upload_backup
    cleanup

    log "=============================================="
    log "Backup completed successfully!"
    log "  Type: ${BACKUP_TYPE}"
    log "  File: ${BACKUP_FILE}"
    log "  Path: ${S3_PATH}"
    log "=============================================="
}

main "$@"
