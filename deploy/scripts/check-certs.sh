#!/bin/bash
# =============================================================================
# TLS Certificate Expiry Checker for ScanOrbit Internal Services
# =============================================================================
# Checks all certificates in deploy/certs/ and warns if any expire soon.
# Exit code 1 if any cert expires within WARN_DAYS (default: 30).
# Usage: ./check-certs.sh
#        WARN_DAYS=60 ./check-certs.sh
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CERTS_DIR="${SCRIPT_DIR}/../certs"
WARN_DAYS="${WARN_DAYS:-30}"
WARN_SECONDS=$((WARN_DAYS * 86400))

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

if [ ! -d "${CERTS_DIR}" ]; then
  echo -e "${RED}[ERROR]${NC} Certs directory not found: ${CERTS_DIR}"
  exit 1
fi

CERTS=$(find "${CERTS_DIR}" -name "*.crt" -type f 2>/dev/null)

if [ -z "${CERTS}" ]; then
  echo -e "${YELLOW}[WARN]${NC} No .crt files found in ${CERTS_DIR}"
  exit 0
fi

HAS_EXPIRING=0
NOW=$(date +%s)

echo "Certificate expiry check (warning threshold: ${WARN_DAYS} days)"
echo "================================================================"

for cert in ${CERTS}; do
  RELATIVE=$(echo "${cert}" | sed "s|${CERTS_DIR}/||")
  EXPIRY_DATE=$(openssl x509 -enddate -noout -in "${cert}" 2>/dev/null | cut -d= -f2)

  if [ -z "${EXPIRY_DATE}" ]; then
    echo -e "${RED}[ERROR]${NC} ${RELATIVE}: could not read expiry date"
    HAS_EXPIRING=1
    continue
  fi

  # macOS and Linux date differ — try GNU date first, fall back to macOS
  if date --version >/dev/null 2>&1; then
    EXPIRY_EPOCH=$(date -d "${EXPIRY_DATE}" +%s 2>/dev/null)
  else
    EXPIRY_EPOCH=$(date -jf "%b %d %T %Y %Z" "${EXPIRY_DATE}" +%s 2>/dev/null)
  fi

  DAYS_LEFT=$(( (EXPIRY_EPOCH - NOW) / 86400 ))

  if [ "${DAYS_LEFT}" -le 0 ]; then
    echo -e "${RED}[EXPIRED]${NC}  ${RELATIVE}: expired ${EXPIRY_DATE} (${DAYS_LEFT}d ago)"
    HAS_EXPIRING=1
  elif [ "${DAYS_LEFT}" -le "${WARN_DAYS}" ]; then
    echo -e "${YELLOW}[WARNING]${NC} ${RELATIVE}: expires ${EXPIRY_DATE} (${DAYS_LEFT}d left)"
    HAS_EXPIRING=1
  else
    echo -e "${GREEN}[OK]${NC}      ${RELATIVE}: expires ${EXPIRY_DATE} (${DAYS_LEFT}d left)"
  fi
done

echo "================================================================"

if [ "${HAS_EXPIRING}" -eq 1 ]; then
  echo -e "${RED}Some certificates need attention!${NC}"
  echo "Regenerate with: ./generate-certs.sh --force"
  exit 1
else
  echo -e "${GREEN}All certificates are valid for more than ${WARN_DAYS} days.${NC}"
  exit 0
fi
