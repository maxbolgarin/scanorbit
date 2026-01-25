#!/bin/bash
# =============================================================================
# TLS Certificate Generation for ScanOrbit Internal Services
# =============================================================================
# Generates self-signed certificates for PostgreSQL and Redis internal TLS
# These are for internal Docker network encryption, not public-facing
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CERTS_DIR="${SCRIPT_DIR}/../certs"
VALIDITY_DAYS=365

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Create directories
mkdir -p "${CERTS_DIR}/postgres" "${CERTS_DIR}/redis"

# =============================================================================
# PostgreSQL Certificates
# =============================================================================
log_info "Generating PostgreSQL certificates..."

POSTGRES_DIR="${CERTS_DIR}/postgres"

# Generate CA key and certificate
openssl genrsa -out "${POSTGRES_DIR}/ca.key" 4096
openssl req -new -x509 -days ${VALIDITY_DAYS} \
    -key "${POSTGRES_DIR}/ca.key" \
    -out "${POSTGRES_DIR}/ca.crt" \
    -subj "/CN=ScanOrbit-PostgreSQL-CA/O=ScanOrbit/C=NL"

# Generate server key and certificate
openssl genrsa -out "${POSTGRES_DIR}/server.key" 4096
openssl req -new \
    -key "${POSTGRES_DIR}/server.key" \
    -out "${POSTGRES_DIR}/server.csr" \
    -subj "/CN=postgres/O=ScanOrbit/C=NL"

# Create SAN extension config for PostgreSQL
cat > "${POSTGRES_DIR}/san.cnf" << EOF
[v3_req]
subjectAltName = @alt_names
[alt_names]
DNS.1 = postgres
DNS.2 = localhost
IP.1 = 127.0.0.1
EOF

# Sign server certificate with CA (with SANs)
openssl x509 -req -days ${VALIDITY_DAYS} \
    -in "${POSTGRES_DIR}/server.csr" \
    -CA "${POSTGRES_DIR}/ca.crt" \
    -CAkey "${POSTGRES_DIR}/ca.key" \
    -CAcreateserial \
    -out "${POSTGRES_DIR}/server.crt" \
    -extfile "${POSTGRES_DIR}/san.cnf" \
    -extensions v3_req

# Set permissions (PostgreSQL requires key to be readable only by owner)
chmod 600 "${POSTGRES_DIR}/server.key"
chmod 644 "${POSTGRES_DIR}/server.crt" "${POSTGRES_DIR}/ca.crt"

# Clean up CSR and temp config
rm -f "${POSTGRES_DIR}/server.csr" "${POSTGRES_DIR}/san.cnf"

log_info "PostgreSQL certificates generated in ${POSTGRES_DIR}"

# =============================================================================
# Redis Certificates
# =============================================================================
log_info "Generating Redis certificates..."

REDIS_DIR="${CERTS_DIR}/redis"

# Generate CA key and certificate (separate from PostgreSQL for isolation)
openssl genrsa -out "${REDIS_DIR}/ca.key" 4096
openssl req -new -x509 -days ${VALIDITY_DAYS} \
    -key "${REDIS_DIR}/ca.key" \
    -out "${REDIS_DIR}/ca.crt" \
    -subj "/CN=ScanOrbit-Redis-CA/O=ScanOrbit/C=NL"

# Generate server key and certificate
openssl genrsa -out "${REDIS_DIR}/redis.key" 4096
openssl req -new \
    -key "${REDIS_DIR}/redis.key" \
    -out "${REDIS_DIR}/redis.csr" \
    -subj "/CN=redis/O=ScanOrbit/C=NL"

# Create SAN extension config for Redis
cat > "${REDIS_DIR}/san.cnf" << EOF
[v3_req]
subjectAltName = @alt_names
[alt_names]
DNS.1 = redis
DNS.2 = localhost
IP.1 = 127.0.0.1
EOF

# Sign server certificate with CA (with SANs)
openssl x509 -req -days ${VALIDITY_DAYS} \
    -in "${REDIS_DIR}/redis.csr" \
    -CA "${REDIS_DIR}/ca.crt" \
    -CAkey "${REDIS_DIR}/ca.key" \
    -CAcreateserial \
    -out "${REDIS_DIR}/redis.crt" \
    -extfile "${REDIS_DIR}/san.cnf" \
    -extensions v3_req

# Generate DH parameters for Redis (optional but recommended)
openssl dhparam -out "${REDIS_DIR}/redis.dh" 2048

# Set permissions
chmod 600 "${REDIS_DIR}/redis.key"
chmod 644 "${REDIS_DIR}/redis.crt" "${REDIS_DIR}/ca.crt" "${REDIS_DIR}/redis.dh"

# Clean up CSR and temp config
rm -f "${REDIS_DIR}/redis.csr" "${REDIS_DIR}/san.cnf"

log_info "Redis certificates generated in ${REDIS_DIR}"

# =============================================================================
# Summary
# =============================================================================
echo ""
log_info "=============================================="
log_info "Certificate generation complete!"
log_info "=============================================="
echo ""
echo "PostgreSQL certificates:"
echo "  - CA:     ${POSTGRES_DIR}/ca.crt"
echo "  - Cert:   ${POSTGRES_DIR}/server.crt"
echo "  - Key:    ${POSTGRES_DIR}/server.key"
echo ""
echo "Redis certificates:"
echo "  - CA:     ${REDIS_DIR}/ca.crt"
echo "  - Cert:   ${REDIS_DIR}/redis.crt"
echo "  - Key:    ${REDIS_DIR}/redis.key"
echo "  - DH:     ${REDIS_DIR}/redis.dh"
echo ""
log_warn "Certificates are valid for ${VALIDITY_DAYS} days."
log_warn "Add a reminder to regenerate before expiration."
echo ""
log_info "Next steps:"
echo "  1. Copy certs to production server"
echo "  2. Update docker-compose.prod.yml"
echo "  3. Restart services"
