#!/bin/sh
# ensure-services.sh — Auto-recovery for critical containers
#
# Watchtower updates containers individually via Docker API, ignoring
# docker-compose depends_on conditions. If a recreate fails (dependency
# not met, transient pull error), the container is removed permanently.
# This script detects missing containers and brings them back.
#
# Install in host crontab:
#   */2 * * * * /opt/scanorbit/deploy/scripts/ensure-services.sh >> /var/log/ensure-services.log 2>&1

set -eu

COMPOSE_DIR="/opt/scanorbit/deploy"
SERVICES="api scanner analyzer"

cd "$COMPOSE_DIR"

for svc in $SERVICES; do
    if ! docker compose ps "$svc" --format json 2>/dev/null | grep -q '"running"'; then
        echo "[$(date -Iseconds)] $svc container missing or not running, recreating..."
        docker compose up -d "$svc" 2>&1
    fi
done
