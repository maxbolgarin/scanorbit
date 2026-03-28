#!/bin/sh
# =============================================================================
# Monitoring Configs Backup Script
# =============================================================================
# Backs up Grafana data volume to Scaleway Object Storage.
# Dashboard JSON files are in git — this catches runtime customizations
# (datasources, annotations, user-created dashboards).
# =============================================================================

set -eu

BACKUP_DIR="/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="configs_${TIMESTAMP}.tar.gz.gpg"
S3_PATH="s3://${SCW_BUCKET_NAME}/configs/${BACKUP_FILE}"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

load_secrets() {
    [ -f /run/secrets/backup_encryption_key ] && export BACKUP_ENCRYPTION_KEY=$(cat /run/secrets/backup_encryption_key | tr -d '\n')
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
    log "Starting configs backup..."
    mkdir -p "${BACKUP_DIR}"

    # Back up Grafana data (mounted at /grafana-data)
    if [ -d "/grafana-data" ]; then
        tar -czf "${BACKUP_DIR}/configs.tar.gz" -C /grafana-data .
    else
        log "WARNING: /grafana-data not found. Creating empty archive."
        tar -czf "${BACKUP_DIR}/configs.tar.gz" --files-from /dev/null
    fi

    # Encrypt
    gpg --symmetric --cipher-algo AES256 --batch --yes \
        --passphrase "${BACKUP_ENCRYPTION_KEY}" \
        -o "${BACKUP_DIR}/${BACKUP_FILE}" \
        "${BACKUP_DIR}/configs.tar.gz"

    rm -f "${BACKUP_DIR}/configs.tar.gz"

    BACKUP_SIZE=$(du -h "${BACKUP_DIR}/${BACKUP_FILE}" | cut -f1)
    log "Configs backup created: ${BACKUP_FILE} (${BACKUP_SIZE})"
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

    log "Configs backup verified in S3"
}

cleanup() {
    rm -f "${BACKUP_DIR}/${BACKUP_FILE}"
}

main() {
    log "=============================================="
    log "Monitoring Configs Backup"
    log "=============================================="

    load_secrets
    install_deps
    create_backup
    upload_backup
    verify_backup
    cleanup

    log "=============================================="
    log "Configs backup completed successfully!"
    log "  File: ${BACKUP_FILE}"
    log "  Path: ${S3_PATH}"
    log "=============================================="
}

main "$@"
