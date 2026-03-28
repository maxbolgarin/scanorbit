#!/bin/bash
# =============================================================================
# Semi-Automated Restore Script
# =============================================================================
# Rebuilds ScanOrbit after Layer 2 terraform destroy.
# Prerequisites:
#   - Admin credentials available (for DNS update)
#   - Deploy credentials in env (TF_VAR_scw_deploy_*)
#   - SSH key loaded in ssh-agent
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TERRAFORM_DIR="$(dirname "$SCRIPT_DIR")"
DEPLOY_DIR="$(dirname "$TERRAFORM_DIR")/deploy"
DOMAIN="${DOMAIN:-scanorbit.cloud}"

log() {
    echo ""
    echo "===================================================================="
    echo "  $1"
    echo "===================================================================="
    echo ""
}

wait_for_ssh() {
    local host="$1"
    local max_attempts=60
    local attempt=0

    echo "Waiting for SSH on ${host}..."
    while [ $attempt -lt $max_attempts ]; do
        if ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no "deploy@${host}" "echo ok" >/dev/null 2>&1; then
            echo "SSH available on ${host}"
            return 0
        fi
        attempt=$((attempt + 1))
        echo "  Attempt ${attempt}/${max_attempts}..."
        sleep 10
    done
    echo "ERROR: SSH not available on ${host} after ${max_attempts} attempts"
    return 1
}

# ─── Step 1: Provision Layer 2 infrastructure ─────────────────────────────────

log "Step 1: Provisioning Layer 2 infrastructure"

cd "${TERRAFORM_DIR}/layer2-server"
terraform init
terraform apply -auto-approve

APP_PUBLIC_IP=$(terraform output -raw public_ip)
CI_PUBLIC_IP=$(terraform output -raw ci_public_ip)
APP_PRIVATE_IP=$(terraform output -raw app_private_ip)

echo "App VM public IP:  ${APP_PUBLIC_IP}"
echo "CI VM public IP:   ${CI_PUBLIC_IP}"
echo "App VM private IP: ${APP_PRIVATE_IP}"

# ─── Step 2: Wait for cloud-init ──────────────────────────────────────────────

log "Step 2: Waiting for cloud-init to complete"

wait_for_ssh "${CI_PUBLIC_IP}"

echo "Waiting 30s for cloud-init to finish setup..."
sleep 30

# Wait for app VM via jump host
ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no \
    -J "deploy@${CI_PUBLIC_IP}" \
    "deploy@${APP_PRIVATE_IP}" "echo 'App VM SSH ready'"

# ─── Step 3: Update DNS if IPs changed ───────────────────────────────────────

log "Step 3: Updating DNS records (requires admin credentials)"

echo "New IPs: app=${APP_PUBLIC_IP}, ci=${CI_PUBLIC_IP}"
echo ""
echo "To update DNS, run in another terminal:"
echo ""
echo "  export TF_VAR_scw_admin_access_key=<from password manager>"
echo "  export TF_VAR_scw_admin_secret_key=<from password manager>"
echo "  cd ${TERRAFORM_DIR}/layer1-backup"
echo "  terraform apply -var app_server_ip=${APP_PUBLIC_IP} -var ci_server_ip=${CI_PUBLIC_IP}"
echo ""
read -p "Press Enter after DNS is updated (or skip if IPs unchanged)..."

# ─── Step 4: Deploy application files ─────────────────────────────────────────

log "Step 4: Deploying application files to server"

rsync -avz --progress \
    -e "ssh -J deploy@${CI_PUBLIC_IP}" \
    "${DEPLOY_DIR}/" \
    "deploy@${APP_PRIVATE_IP}:/opt/scanorbit/"

# ─── Step 5: Restore secrets ─────────────────────────────────────────────────

log "Step 5: Restoring secrets"

echo "Option A: Download secrets backup from S3 and decrypt"
echo "Option B: Manually place secrets from password manager"
echo ""
echo "For Option B, create files in /opt/scanorbit/secrets/ on the server:"
echo "  ssh -J deploy@${CI_PUBLIC_IP} deploy@${APP_PRIVATE_IP}"
echo "  cd /opt/scanorbit && ./scripts/setup-secrets.sh"
echo ""
read -p "Press Enter when secrets are in place..."

# ─── Step 6: Generate internal TLS certs ──────────────────────────────────────

log "Step 6: Generating internal TLS certificates"

ssh -J "deploy@${CI_PUBLIC_IP}" "deploy@${APP_PRIVATE_IP}" \
    "cd /opt/scanorbit && bash scripts/generate-certs.sh"

# ─── Step 7: Start infrastructure services ───────────────────────────────────

log "Step 7: Starting PostgreSQL and Redis"

ssh -J "deploy@${CI_PUBLIC_IP}" "deploy@${APP_PRIVATE_IP}" \
    "cd /opt/scanorbit && docker compose up -d postgres redis"

echo "Waiting 15s for databases to initialize..."
sleep 15

# ─── Step 8: Restore database ────────────────────────────────────────────────

log "Step 8: Restoring database from backup"

echo "Listing available backups..."
ssh -J "deploy@${CI_PUBLIC_IP}" "deploy@${APP_PRIVATE_IP}" \
    "cd /opt/scanorbit && docker compose run --rm db-restore --list"

echo ""
read -p "Enter backup path to restore (e.g., db/daily/scanorbit_20260327_020000.sql.gz.gpg): " BACKUP_PATH

ssh -J "deploy@${CI_PUBLIC_IP}" "deploy@${APP_PRIVATE_IP}" \
    "cd /opt/scanorbit && docker compose run --rm db-restore ${BACKUP_PATH}"

# ─── Step 9: Start all services ──────────────────────────────────────────────

log "Step 9: Starting all services"

ssh -J "deploy@${CI_PUBLIC_IP}" "deploy@${APP_PRIVATE_IP}" \
    "cd /opt/scanorbit && docker compose up -d"

echo "Waiting 30s for services to start..."
sleep 30

# ─── Step 10: Verify ─────────────────────────────────────────────────────────

log "Step 10: Verifying deployment"

echo "Checking API health..."
if curl -sf "https://api.${DOMAIN}/health" >/dev/null 2>&1; then
    echo "  API: OK"
else
    echo "  API: FAILED (may need DNS propagation time)"
fi

echo "Checking app..."
if curl -sf "https://app.${DOMAIN}" >/dev/null 2>&1; then
    echo "  App: OK"
else
    echo "  App: FAILED (may need DNS propagation time)"
fi

echo "Checking landing..."
if curl -sf "https://${DOMAIN}" >/dev/null 2>&1; then
    echo "  Landing: OK"
else
    echo "  Landing: FAILED (may need DNS propagation time)"
fi

log "Restore complete!"

echo "Next steps:"
echo "  1. Verify all services are running: docker compose ps"
echo "  2. Test backup job: docker compose exec postgres-backup /usr/local/bin/backup.sh"
echo "  3. Update any webhook URLs if needed (Stripe, GitHub, etc.)"
