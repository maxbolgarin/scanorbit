#!/bin/sh
# =============================================================================
# ScanOrbit — Production Bootstrap
# =============================================================================
# One-time setup: creates Docker secrets, generates TLS certificates,
# authenticates with GHCR, and sets file permissions.
#
# Idempotent — safe to re-run.
#
# Usage:
#   ./scripts/bootstrap.sh secrets.env    # Read secrets from file
#   ./scripts/bootstrap.sh                # Interactive mode
#
# Environment variables (optional, prompts if not set):
#   GITHUB_USERNAME  — GitHub username for GHCR login
#   GITHUB_TOKEN     — GitHub PAT with read:packages scope
# =============================================================================

set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

log() {
  echo ""
  echo "[bootstrap] $1"
  echo ""
}

# =============================================================================
# 1. Set up Docker secrets
# =============================================================================
log "Step 1/4: Setting up Docker secrets..."

if [ -n "${1:-}" ] && [ -f "${1:-}" ]; then
  "$SCRIPT_DIR/setup-secrets.sh" "$1"
  echo ""
  echo "[bootstrap] DELETE the secrets file now: rm -f $1"
else
  "$SCRIPT_DIR/setup-secrets.sh"
fi

# =============================================================================
# 2. Generate TLS certificates
# =============================================================================
log "Step 2/4: Generating TLS certificates..."

"$SCRIPT_DIR/generate-certs.sh"

# =============================================================================
# 3. Authenticate with GHCR
# =============================================================================
log "Step 3/4: Authenticating with GitHub Container Registry..."

GITHUB_USERNAME="${GITHUB_USERNAME:-}"
GITHUB_TOKEN="${GITHUB_TOKEN:-}"

if [ -z "$GITHUB_USERNAME" ]; then
  printf "  GitHub username: "
  read -r GITHUB_USERNAME
fi

if [ -z "$GITHUB_TOKEN" ]; then
  printf "  GitHub PAT (read:packages scope): "
  read -r GITHUB_TOKEN
fi

echo "$GITHUB_TOKEN" | docker login ghcr.io -u "$GITHUB_USERNAME" --password-stdin

# =============================================================================
# 4. Set file permissions
# =============================================================================
log "Step 4/4: Setting file permissions..."

chmod 600 "$DEPLOY_DIR/.env"

chmod 700 "$DEPLOY_DIR/secrets/"
chmod 600 "$DEPLOY_DIR/secrets/"*

chmod +x "$DEPLOY_DIR/scripts/"*.sh
chmod +x "$DEPLOY_DIR/entrypoints/"*.sh

echo "  .env           → 600"
echo "  secrets/       → 700"
echo "  secrets/*      → 600"
echo "  scripts/*.sh   → +x"
echo "  entrypoints/*  → +x"

# =============================================================================
# Done
# =============================================================================
log "=============================================="
echo "[bootstrap] Bootstrap complete!"
echo ""
echo "[bootstrap] Next: docker compose up -d"
echo "[bootstrap] =============================================="
