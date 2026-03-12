# ScanOrbit Scaleway Infrastructure

Terraform configuration for deploying ScanOrbit on Scaleway Cloud with GDPR compliance.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Scaleway Cloud (EU - Amsterdam)                  │
└─────────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
   ┌────▼────┐          ┌─────▼─────┐         ┌────▼────┐
   │   DNS   │          │ Reserved  │         │ Security│
   │ Records │          │    IP     │         │  Group  │
   └────┬────┘          └─────┬─────┘         └────┬────┘
        │                     │                    │
        └─────────────────────┼────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │     DEV1-M VM     │
                    │   (Docker Host)   │
                    │                   │
                    │ [Encrypted Block  │
                    │     Storage]      │
                    └─────────┬─────────┘
                              │
              ┌───────────────┴───────────────┐
              │        Docker Compose         │
              │                               │
              │  ┌─────────────────────────┐  │
              │  │   Caddy (80/443)        │──┼──► HTTPS + Let's Encrypt
              │  └───────────┬─────────────┘  │
              │              │                │
              │  ┌───────────▼─────────────┐  │
              │  │ API (Node.js + Hono)    │  │
              │  │ + Audit Logging         │  │
              │  │ + GDPR Endpoints        │  │
              │  └───────────┬─────────────┘  │
              │              │                │
              │     [TLS Required]            │
              │              │                │
              │  ┌───────────▼─────────────┐  │
              │  │ PostgreSQL 17 (SSL)     │  │
              │  │ + Query Logging         │  │
              │  └───────────┬─────────────┘  │
              │              │                │
              │  ┌───────────▼─────────────┐  │
              │  │ Redis 7 (TLS + Auth)    │  │
              │  └───────────┬─────────────┘  │
              │              │                │
              │  ┌───────────▼─────────────┐  │
              │  │ Backup Container        │  │
              │  │ (Daily @ 02:00 UTC)     │  │
              │  └───────────┬─────────────┘  │
              │              │                │
              │  ┌───────────▼─────────────┐  │
              │  │ Retention Cleanup       │  │
              │  │ (Daily @ 03:00 UTC)     │  │
              │  └─────────────────────────┘  │
              └───────────────┬───────────────┘
                              │ [HTTPS + Encrypted]
                              ▼
              ┌───────────────────────────────┐
              │   Scaleway Object Storage     │
              │   (Encrypted Backups)         │
              │   30/90/365 day lifecycle     │
              └───────────────────────────────┘
```

## GDPR Compliance Features

| Requirement | Implementation | Status |
|-------------|----------------|--------|
| EU Data Residency | Amsterdam (nl-ams) region | ✅ |
| Encryption at Rest | Encrypted block storage | ✅ |
| Encryption in Transit | TLS for PostgreSQL, Redis, external | ✅ |
| Automated Backups | Daily encrypted backups to S3 | ✅ |
| Audit Logging | All API requests logged | ✅ |
| Data Retention | Configurable auto-cleanup | ✅ |
| Right to Erasure | GDPR deletion API | ✅ |
| Right to Portability | Data export API | ✅ |

See [GDPR Compliance Documentation](../../docs/gdpr-compliance.md) for details.

## Prerequisites

1. **Scaleway Account** with API credentials
2. **Domain** registered or transferred to Scaleway Domains
3. **SSH Key** registered in Scaleway IAM
4. **Scaleway CLI** (`scw`) installed

### Installing Scaleway CLI

#### macOS (Homebrew)
```bash
brew install scw
```

#### Linux
```bash
curl -o /usr/local/bin/scw -L "https://github.com/scaleway/scaleway-cli/releases/latest/download/scw-linux-x86_64"
chmod +x /usr/local/bin/scw
```

#### Windows
```powershell
scoop bucket add scaleway https://github.com/scaleway/scoop-bucket.git
scoop install scaleway-cli
```

#### Verify Installation
```bash
scw version
```

### Setting up Scaleway Credentials

```bash
scw init
```

### Getting SSH Key ID

```bash
# List your SSH keys
scw iam ssh-key list

# Or find at: https://console.scaleway.com/iam/ssh-keys
```

## Deployment

### 1. Configure Variables

```bash
cd deploy/scaleway

# Copy example config
cp terraform.tfvars.example terraform.tfvars

# Edit with your values
vim terraform.tfvars
```

Required variables:
```hcl
domain           = "scanorbit.cloud"
ssh_public_keys  = ["ssh-ed25519 AAAAC3..."]
environment      = "production"
```

### 2. Initialize and Apply Terraform

```bash
# Initialize Terraform
terraform init

# Review the plan
terraform plan

# Apply infrastructure
terraform apply
```

### 3. Note Outputs

```bash
# Get all outputs
terraform output

# Key values for .env configuration:
terraform output public_ip
terraform output backup_bucket_name
terraform output backup_bucket_endpoint
terraform output backup_access_key
terraform output -raw backup_secret_key
```

### 4. Prepare Environment File

On your local machine, create `.env` from the example:

```bash
cp .env.example .env
vim .env
```

**Required GDPR-related variables:**
```bash
# Database with SSL
DATABASE_URL=postgresql://scanorbit:PASSWORD@postgres:5432/scanorbit?sslmode=require

# Redis with TLS
REDIS_PASSWORD=<strong-password>
REDIS_URL=rediss://:PASSWORD@redis:6379

# Backup encryption (generate with: openssl rand -hex 32)
BACKUP_ENCRYPTION_KEY=<64-char-hex>

# Scaleway S3 for backups (from terraform output)
SCW_ACCESS_KEY=<from-terraform-output>
SCW_SECRET_KEY=<from-terraform-output>
SCW_BUCKET_NAME=<from-terraform-output>
SCW_REGION=nl-ams

# Data retention (days)
RETENTION_RESOURCES_DAYS=90
RETENTION_FINDINGS_RESOLVED_DAYS=180
RETENTION_SCANS_DAYS=365
RETENTION_AUDIT_LOGS_DAYS=730
```

### 5. Copy Deployment Files to Server

Copy only the required files (scripts are pre-installed via cloud-init):

```bash
PUBLIC_IP=$(terraform output -raw public_ip)

# Copy docker-compose, Caddyfile, and environment
scp deploy/docker-compose.yml deploy/Caddyfile \
    deploy@${PUBLIC_IP}:/opt/scanorbit/deploy/

scp .env deploy@${PUBLIC_IP}:/opt/scanorbit/deploy/
```

### 6. Generate TLS Certificates

SSH into the server and generate certificates (scripts are pre-installed):

```bash
ssh deploy@$(terraform output -raw public_ip)

cd /opt/scanorbit/deploy
./scripts/generate-certs.sh
```

This creates:
- `certs/postgres/` - PostgreSQL CA and server certificates
- `certs/redis/` - Redis CA and server certificates

### 7. Configure GHCR and Start Services

```bash
# Login to GitHub Container Registry
echo 'YOUR_GITHUB_PAT' | docker login ghcr.io -u maxbolgarin --password-stdin

# Start all services (migrations run automatically)
docker compose -f docker-compose.yml up -d

# Verify services are healthy
docker compose -f docker-compose.yml ps
```

### 8. Verify GDPR Components

```bash
# Check backup container
docker compose -f docker-compose.yml logs postgres-backup

# Check retention cleanup
docker compose -f docker-compose.yml logs retention-cleanup

# Verify TLS connections
docker compose -f docker-compose.yml exec postgres \
  psql -U scanorbit -c "SELECT ssl_is_used();"

# Test Redis TLS
docker compose -f docker-compose.yml exec redis \
  redis-cli --tls --cert /tls/redis.crt --key /tls/redis.key \
  --cacert /tls/ca.crt -a $REDIS_PASSWORD ping
```

## Resources Created

| Resource | Type | Description |
|----------|------|-------------|
| `scaleway_instance_ip` | Reserved IP | Static public IPv4 |
| `scaleway_instance_security_group` | Firewall | Allow SSH, HTTP, HTTPS |
| `scaleway_instance_server` | DEV1-M VM | Docker host |
| `scaleway_instance_volume` | Block Storage | Encrypted data volume |
| `scaleway_object_bucket` | S3 Bucket | Encrypted backup storage |
| `scaleway_object_bucket_policy` | Bucket Policy | Access control |
| `scaleway_iam_application` | IAM App | Backup service account |
| `scaleway_iam_api_key` | API Key | Backup credentials |
| `scaleway_domain_record` | DNS A | Root domain |
| `scaleway_domain_record` | DNS CNAME | www subdomain |
| `scaleway_domain_record` | DNS A | app subdomain |
| `scaleway_domain_record` | DNS A | api subdomain |

## DNS Records

| Record | Type | Value |
|--------|------|-------|
| `scanorbit.cloud` | A | VM Public IP |
| `www.scanorbit.cloud` | CNAME | scanorbit.cloud |
| `app.scanorbit.cloud` | A | VM Public IP |
| `api.scanorbit.cloud` | A | VM Public IP |

## Instance Types

| Type | vCPU | RAM | Storage | Price |
|------|------|-----|---------|-------|
| DEV1-S | 2 | 2GB | 20GB | ~€4/mo |
| **DEV1-M** | 3 | 4GB | 40GB | ~€7/mo |
| DEV1-L | 4 | 8GB | 80GB | ~€14/mo |
| GP1-XS | 4 | 16GB | 150GB | ~€20/mo |

## Outputs

```bash
# View all outputs
terraform output

# Key outputs
terraform output public_ip
terraform output ssh_command
terraform output domain_url
terraform output backup_bucket_name
terraform output backup_bucket_endpoint
terraform output data_volume_id
```

## Maintenance

### SSH Access

```bash
ssh deploy@$(terraform output -raw public_ip)
```

### View Logs

```bash
# All services
docker compose -f docker-compose.yml logs -f

# Specific service
docker compose -f docker-compose.yml logs -f api

# Backup logs
docker compose -f docker-compose.yml logs -f postgres-backup

# Retention cleanup logs
docker compose -f docker-compose.yml logs -f retention-cleanup
```

### Manual Backup

```bash
# Trigger backup manually
docker compose -f docker-compose.yml exec postgres-backup \
  /usr/local/bin/backup.sh

# List backups in S3
aws s3 ls s3://${SCW_BUCKET_NAME}/ \
  --endpoint-url https://s3.nl-ams.scw.cloud
```

### Restore from Backup

```bash
# List available backups
./scripts/restore.sh --list

# Restore specific backup
./scripts/restore.sh scanorbit_backup_20240115_020000.sql.gz.gpg
```

### Manual Retention Cleanup

```bash
docker compose -f docker-compose.yml exec retention-cleanup \
  node dist/jobs/retention-cleanup.js
```

### Update Application

```bash
cd /opt/scanorbit
git pull
docker compose -f docker-compose.yml pull
docker compose -f docker-compose.yml up -d
```

### Regenerate TLS Certificates

```bash
cd /opt/scanorbit/deploy

# Regenerate (will overwrite existing)
./scripts/generate-certs.sh

# Restart services to pick up new certs
docker compose -f docker-compose.yml restart postgres redis
```

### Destroy Infrastructure

```bash
terraform destroy
```

## Cost Estimate

| Resource | Monthly Cost |
|----------|--------------|
| DEV1-M Instance | ~€7 |
| Reserved IP | ~€3 |
| Block Storage (20GB) | ~€2 |
| Object Storage (~10GB) | ~€1 |
| DNS | Free |
| **Total** | **~€13/month** |

## Troubleshooting

### TLS Certificate Issues

```bash
# Check certificate validity
openssl x509 -in deploy/certs/postgres/server.crt -text -noout

# Verify PostgreSQL SSL
docker compose -f docker-compose.yml exec postgres \
  psql -U scanorbit -c "SHOW ssl;"

# Check Redis TLS
docker compose -f docker-compose.yml logs redis | grep -i tls
```

### Backup Failures

```bash
# Check backup logs
docker compose -f docker-compose.yml logs postgres-backup

# Test S3 connectivity
docker compose -f docker-compose.yml exec postgres-backup \
  aws s3 ls s3://${SCW_BUCKET_NAME}/ \
  --endpoint-url https://s3.nl-ams.scw.cloud

# Verify encryption key is set
docker compose -f docker-compose.yml exec postgres-backup \
  printenv BACKUP_ENCRYPTION_KEY
```

### Retention Cleanup Issues

```bash
# Check retention logs
docker compose -f docker-compose.yml logs retention-cleanup

# Run manually with verbose output
docker compose -f docker-compose.yml exec retention-cleanup \
  node dist/jobs/retention-cleanup.js
```

### DNS not resolving

DNS propagation can take up to 48 hours. Check with:

```bash
dig scanorbit.cloud
nslookup scanorbit.cloud
```

### SSL certificate not issued (Caddy)

Ensure ports 80 and 443 are accessible:

```bash
sudo ufw status
curl -I http://scanorbit.cloud
```

### Docker not starting

```bash
sudo systemctl status docker
sudo journalctl -u docker
```

## Security Hardening

The VM is configured with the following security measures:

### SSH Security

| Setting | Value | Description |
|---------|-------|-------------|
| Login User | `deploy` | Non-root user with sudo access |
| Root Login | **Disabled** | `PermitRootLogin no` |
| Password Auth | **Disabled** | SSH keys only |
| Max Auth Tries | 3 | Limits brute-force attempts |
| Allowed Users | `deploy` | Only deploy user can SSH |

### Automatic Protections

| Feature | Description |
|---------|-------------|
| **fail2ban** | Blocks IPs after 3 failed SSH attempts (1 hour ban) |
| **UFW Firewall** | Only ports 22, 80, 443 open |
| **Unattended Upgrades** | Security patches applied daily |
| **Strong Ciphers** | Modern cryptographic algorithms only |

### Internal Encryption

| Component | Encryption |
|-----------|------------|
| PostgreSQL | TLS 1.2+ with self-signed CA |
| Redis | TLS 1.2+ with password auth |
| Backups | AES-256 GPG encryption |
| Block Storage | Scaleway-managed encryption |

### Security Audit

Run the built-in security audit script:

```bash
ssh deploy@$(terraform output -raw public_ip)
/opt/security-audit.sh
```

This shows:
- SSH configuration status
- fail2ban banned IPs
- Firewall rules
- Recent failed login attempts
- Unattended upgrade status

### Network Security

- All public traffic routed through Caddy with automatic TLS
- PostgreSQL and Redis only accessible via Docker network with TLS
- Default deny incoming, allow outgoing firewall policy
- Internal services require TLS authentication
