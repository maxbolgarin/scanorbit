#!/usr/bin/env bash
# Deploy updated services to production.
# Usage: deploy.sh [service ...]
#   e.g. deploy.sh api app scanner analyzer
# Called by GitHub Actions after new images are pushed to GHCR.
set -euo pipefail

DEPLOY_DIR="/opt/scanorbit/deploy"
COMPOSE="docker compose -f $DEPLOY_DIR/docker-compose.yml"

cd "$DEPLOY_DIR"

SERVICES=("$@")

if [[ ${#SERVICES[@]} -eq 0 ]]; then
  echo "No services specified, nothing to deploy."
  exit 0
fi

echo "==> Deploying: ${SERVICES[*]}"

# Pull updated images first (fail fast if registry is unreachable)
$COMPOSE pull "${SERVICES[@]}"

# Run database migrations before restarting the API
if printf '%s\n' "${SERVICES[@]}" | grep -q '^api$'; then
  echo "==> Running database migrations..."
  $COMPOSE run --rm migrate
fi

# Restart updated services with the freshly pulled images
$COMPOSE up -d --no-deps --pull never "${SERVICES[@]}"

echo "==> Deploy complete: ${SERVICES[*]}"
