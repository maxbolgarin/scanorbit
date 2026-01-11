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

# Determine backup type and path
if [ "$DAY_OF_MONTH" = "01" ]; then
    BACKUP_TYPE="monthly"
elif [ "$DAY_OF_WEEK" = "7" ]; then
    BACKUP_TYPE="weekly"
else
    BACKUP_TYPE="daily"
fi

BACKUP_FILE="scanorbit_${TIMESTAMP}.sql.gz.gpg"
S3_PATH="s3://${SCW_BUCKET_NAME}/${BACKUP_TYPE}/${BACKUP_FILE}"

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

    # Dump database, compress, and encrypt
    log "Dumping database..."
    pg_dump --clean --if-exists --format=plain 2>/dev/null | \
        gzip | \
        gpg --symmetric --cipher-algo AES256 --batch --yes \
            --passphrase "${BACKUP_ENCRYPTION_KEY}" \
        > "${BACKUP_DIR}/${BACKUP_FILE}"

    # Calculate checksum
    sha256sum "${BACKUP_DIR}/${BACKUP_FILE}" > "${BACKUP_DIR}/${BACKUP_FILE}.sha256"

    log "Backup created: ${BACKUP_FILE} ($(du -h "${BACKUP_DIR}/${BACKUP_FILE}" | cut -f1))"
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

# Verify backup
verify_backup() {
    log "Verifying backup..."

    S3_ENDPOINT="https://s3.${SCW_REGION}.scw.cloud"

    # Check if file exists in S3
    if aws --endpoint-url "${S3_ENDPOINT}" s3 ls "${S3_PATH}" >/dev/null 2>&1; then
        log "Backup verified successfully"
        return 0
    else
        log "ERROR: Backup verification failed!"
        return 1
    fi
}

# Main execution
main() {
    log "=============================================="
    log "PostgreSQL Backup - ${BACKUP_TYPE}"
    log "=============================================="

    install_deps
    create_backup
    upload_backup
    verify_backup
    cleanup

    log "=============================================="
    log "Backup completed successfully!"
    log "  Type: ${BACKUP_TYPE}"
    log "  File: ${BACKUP_FILE}"
    log "  Path: ${S3_PATH}"
    log "=============================================="
}

main "$@"
