#!/bin/sh
# =============================================================================
# ScanOrbit — Production Bootstrap
# =============================================================================
# One-time setup: creates Docker secrets, generates TLS certificates,
# authenticates with GHCR, prepares PostgreSQL data dir, and sets permissions.
#
# Idempotent — safe to re-run. Skips steps that are already done.
#
# Usage (requires root):
#   sudo ./scripts/bootstrap.sh                           # All steps
#   sudo ./scripts/bootstrap.sh secrets.env               # All steps, secrets from file
#   sudo ./scripts/bootstrap.sh --secrets secrets.env     # Secrets only
#   sudo ./scripts/bootstrap.sh --tls                     # TLS certs only
#   sudo ./scripts/bootstrap.sh --github                  # GHCR auth only
#   sudo ./scripts/bootstrap.sh --tls --github            # Combine flags
#   sudo ./scripts/bootstrap.sh --force --tls             # Force regenerate certs
#
# Flags:
#   --secrets <file>  — set up Docker secrets from file
#   --tls             — generate TLS certificates
#   --github          — authenticate with GHCR
#   --force           — skip freshness/state checks, redo everything requested
#
# With no step flags, all steps run. Step flags select only those steps.
# PostgreSQL data dir and file permissions always run.
#
# Environment variables (optional, prompts if not set):
#   GITHUB_USERNAME  — GitHub username for GHCR login
#   GITHUB_TOKEN     — GitHub PAT with read:packages scope
# =============================================================================

set -eu

# Bootstrap requires root for chown operations (postgres data dir, cert ownership)
if [ "$(id -u)" -ne 0 ]; then
  echo "[bootstrap] ERROR: must run as root (sudo ./scripts/bootstrap.sh ...)"
  exit 1
fi

# Parse arguments
FORCE=false
SECRETS_FILE=""
FLAG_SECRETS=false
FLAG_TLS=false
FLAG_GITHUB=false
HAS_STEP_FLAGS=false

while [ $# -gt 0 ]; do
  case "$1" in
    --force)   FORCE=true ;;
    --secrets)
      FLAG_SECRETS=true; HAS_STEP_FLAGS=true
      shift
      if [ $# -gt 0 ] && [ "${1#-}" = "$1" ]; then
        SECRETS_FILE="$1"
      else
        echo "[bootstrap] ERROR: --secrets requires a file argument"
        exit 1
      fi
      ;;
    --tls)     FLAG_TLS=true;    HAS_STEP_FLAGS=true ;;
    --github)  FLAG_GITHUB=true; HAS_STEP_FLAGS=true ;;
    *)
      # Positional arg — treat as secrets file (backward compat)
      if [ -z "$SECRETS_FILE" ]; then
        SECRETS_FILE="$1"
        FLAG_SECRETS=true
        HAS_STEP_FLAGS=true
      else
        echo "[bootstrap] ERROR: unknown argument: $1"
        exit 1
      fi
      ;;
  esac
  shift
done

# No step flags → run everything
if [ "$HAS_STEP_FLAGS" = false ]; then
  FLAG_SECRETS=true
  FLAG_TLS=true
  FLAG_GITHUB=true
fi

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
if [ "$FLAG_SECRETS" = true ]; then
  log "Setting up Docker secrets..."

  if [ -n "$SECRETS_FILE" ] && [ -f "$SECRETS_FILE" ]; then
    "$SCRIPT_DIR/setup-secrets.sh" "$SECRETS_FILE"
    echo ""
    echo "[bootstrap] DELETE the secrets file now: rm -f $SECRETS_FILE"
  elif [ -n "$SECRETS_FILE" ]; then
    echo "[bootstrap] ERROR: secrets file not found: $SECRETS_FILE"
    exit 1
  else
    "$SCRIPT_DIR/setup-secrets.sh"
  fi
fi

# =============================================================================
# 2. Generate TLS certificates
# =============================================================================
if [ "$FLAG_TLS" = true ]; then
  log "Generating TLS certificates..."

  # Ensure certs directories exist with correct ownership
  CERTS_DIR="$DEPLOY_DIR/certs"
  mkdir -p "$CERTS_DIR/postgres" "$CERTS_DIR/redis"
  chown -R "$(id -u):$(id -g)" "$CERTS_DIR"

  if [ "$FORCE" = true ]; then
    "$SCRIPT_DIR/generate-certs.sh" --force
  else
    "$SCRIPT_DIR/generate-certs.sh"
  fi
fi

# =============================================================================
# 3. Authenticate with GHCR
# =============================================================================
if [ "$FLAG_GITHUB" = true ]; then
  log "Authenticating with GitHub Container Registry..."

  # Resolve the real (non-root) user's home for Docker config
  # SUDO_USER is set by sudo to the invoking user
  REAL_USER="${SUDO_USER:-}"
  if [ -n "$REAL_USER" ]; then
    REAL_HOME=$(eval echo "~$REAL_USER")
  else
    REAL_HOME="$HOME"
  fi
  REAL_DOCKER_CONFIG="${REAL_HOME}/.docker"

  # Check if already authenticated with GHCR via Docker config
  GHCR_AUTHENTICATED=false
  if [ "$FORCE" = false ] && grep -qs "ghcr.io" "${REAL_DOCKER_CONFIG}/config.json" 2>/dev/null; then
    GHCR_AUTHENTICATED=true
  fi

  if [ "$GHCR_AUTHENTICATED" = true ]; then
    echo "  Already authenticated with ghcr.io — skipping (use --force to re-authenticate)"
  else
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

    # Login as the real user so credentials are in their Docker config
    mkdir -p "$REAL_DOCKER_CONFIG"
    echo "$GITHUB_TOKEN" | DOCKER_CONFIG="$REAL_DOCKER_CONFIG" docker login ghcr.io -u "$GITHUB_USERNAME" --password-stdin

    # Fix ownership — docker login as root creates files owned by root
    if [ -n "$REAL_USER" ]; then
      chown -R "$REAL_USER" "$REAL_DOCKER_CONFIG"
    fi
  fi
fi

# =============================================================================
# 4. Prepare PostgreSQL data directory on host
# =============================================================================
log "Preparing PostgreSQL data directory..."

# Source .env to get POSTGRES_DATA_DIR if set
if [ -f "$DEPLOY_DIR/.env" ]; then
  POSTGRES_DATA_DIR=$(grep -E "^POSTGRES_DATA_DIR=" "$DEPLOY_DIR/.env" 2>/dev/null | cut -d'=' -f2- || true)
fi
POSTGRES_DATA_DIR="${POSTGRES_DATA_DIR:-/var/lib/scanorbit/postgres}"

mkdir -p "$POSTGRES_DATA_DIR"
# UID 70 = postgres user inside postgres:17-alpine
chown 70:70 "$POSTGRES_DATA_DIR"
chmod 700 "$POSTGRES_DATA_DIR"

echo "  PostgreSQL data → ${POSTGRES_DATA_DIR} (owner=70:70, mode=700)"

# =============================================================================
# 5. Set file permissions
# =============================================================================
log "Setting file permissions..."

chmod 600 "$DEPLOY_DIR/.env"

if [ -d "$DEPLOY_DIR/secrets" ]; then
  chmod 700 "$DEPLOY_DIR/secrets/"
  # Files need 644 so Docker containers can read them (container UIDs may differ from host)
  # The secrets/ directory is 700, so only the host owner can enter it
  chmod 644 "$DEPLOY_DIR/secrets/"*
  echo "  secrets/       → 700"
  echo "  secrets/*      → 644"
fi

if [ -d "$DEPLOY_DIR/certs" ]; then
  chmod 700 "$DEPLOY_DIR/certs/" "$DEPLOY_DIR/certs/postgres" "$DEPLOY_DIR/certs/redis"
  # Keys must be 600, certs/CA/DH are public and need 644 for Docker container access
  chmod 600 "$DEPLOY_DIR/certs/postgres/"*.key "$DEPLOY_DIR/certs/redis/"*.key
  chmod 644 "$DEPLOY_DIR/certs/postgres/"*.crt "$DEPLOY_DIR/certs/redis/"*.crt "$DEPLOY_DIR/certs/redis/"*.dh
  echo "  certs/         → 700"
  echo "  certs/**/*.key → 600"
  echo "  certs/**/*.crt → 644"
fi

chmod +x "$DEPLOY_DIR/scripts/"*.sh
chmod +x "$DEPLOY_DIR/entrypoints/"*.sh

echo "  .env           → 600"
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
