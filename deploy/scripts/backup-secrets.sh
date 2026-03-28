#!/bin/sh
# =============================================================================
# Docker Secrets Backup Script
# =============================================================================
# Backs up all Docker secrets to Scaleway Object Storage.
# Encrypted with a SEPARATE master key (not the DB backup key).
# =============================================================================

set -eu

BACKUP_DIR="/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="secrets_${TIMESTAMP}.tar.gz.gpg"
S3_PATH="s3://${SCW_BUCKET_NAME}/secrets/${BACKUP_FILE}"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Load S3 credentials from Docker secrets
load_secrets() {
    [ -f /run/secrets/secrets_master_key ] && export SECRETS_MASTER_KEY=$(cat /run/secrets/secrets_master_key | tr -d '\n')
    [ -f /run/secrets/scw_access_key ] && export SCW_ACCESS_KEY=$(cat /run/secrets/scw_access_key | tr -d '\n')
    [ -f /run/secrets/scw_secret_key ] && export SCW_SECRET_KEY=$(cat /run/secrets/scw_secret_key | tr -d '\n')
}

install_deps() {
    if ! command -v gpg >/dev/null 2>&1 || ! command -v aws >/dev/null 2>&1; then
        log "Installing dependencies..."
        apk add --no-cache gnupg aws-cli
    fi
}

create_backup() {
    log "Starting secrets backup..."
    mkdir -p "${BACKUP_DIR}"

    # Create tarball of all Docker secrets
    tar -czf "${BACKUP_DIR}/secrets.tar.gz" -C /run/secrets .

    # Encrypt with secrets master key (different from DB backup key)
    gpg --symmetric --cipher-algo AES256 --batch --yes \
        --passphrase "${SECRETS_MASTER_KEY}" \
        -o "${BACKUP_DIR}/${BACKUP_FILE}" \
        "${BACKUP_DIR}/secrets.tar.gz"

    rm -f "${BACKUP_DIR}/secrets.tar.gz"

    BACKUP_SIZE=$(du -h "${BACKUP_DIR}/${BACKUP_FILE}" | cut -f1)
    log "Secrets backup created: ${BACKUP_FILE} (${BACKUP_SIZE})"
}

upload_backup() {
    log "Uploading to Scaleway Object Storage..."

    export AWS_ACCESS_KEY_ID="${SCW_ACCESS_KEY}"
    export AWS_SECRET_ACCESS_KEY="${SCW_SECRET_KEY}"
    export AWS_DEFAULT_REGION="${SCW_REGION}"
    S3_ENDPOINT="https://s3.${SCW_REGION}.scw.cloud"

    aws --endpoint-url "${S3_ENDPOINT}" s3 cp \
        "${BACKUP_DIR}/${BACKUP_FILE}" \
        "${S3_PATH}" \
        --storage-class STANDARD

    log "Upload complete: ${S3_PATH}"
}

verify_backup() {
    log "Verifying backup..."

    S3_ENDPOINT="https://s3.${SCW_REGION}.scw.cloud"

    if ! aws --endpoint-url "${S3_ENDPOINT}" s3 ls "${S3_PATH}" >/dev/null 2>&1; then
        log "ERROR: Backup file not found in S3!"
        return 1
    fi

    log "Secrets backup verified in S3"
}

cleanup() {
    rm -f "${BACKUP_DIR}/${BACKUP_FILE}"
}

main() {
    log "=============================================="
    log "Docker Secrets Backup"
    log "=============================================="

    load_secrets
    install_deps
    create_backup
    upload_backup
    verify_backup
    cleanup

    log "=============================================="
    log "Secrets backup completed successfully!"
    log "  File: ${BACKUP_FILE}"
    log "  Path: ${S3_PATH}"
    log "=============================================="
}

main "$@"
