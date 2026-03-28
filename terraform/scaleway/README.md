# ScanOrbit Scaleway Infrastructure

Terraform configuration for deploying ScanOrbit on Scaleway Cloud with GDPR compliance.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Scaleway Cloud (EU - Amsterdam)                  │
└─────────────────────────────────────────────────────────────────────┘
                              │
          Internet ───────────┼───────────────────────────
                              │
    ┌─────────────────────────┼──────────────────────────────┐
    │                         │                              │
    │  ci.scanorbit.cloud     │  scanorbit.cloud             │
    │  (SSH :22)              │  app/api.scanorbit.cloud     │
    │         │               │  (HTTP/HTTPS :80/:443)       │
    │         ▼               │           │                  │
    │  ┌──────────────┐       │    ┌──────▼──────────┐       │
    │  │  CI VM       │       │    │   App VM        │       │
    │  │  (DEV1-M)    │       │    │   (DEV1-M)      │       │
    │  │              │       │    │                  │       │
    │  │ 3 GitHub     │  Private   │  Docker Compose │       │
    │  │ Runners ×2   │  Network   │  (all services) │       │
    │  │ (scanorbit + │◄──────────►│                  │       │
    │  │  biomaxing)  │ 10.10.0.0  │  No public SSH  │       │
    │  │              │   /24      │  (jump only)    │       │
    │  │ Jump Host    │       │    │                  │       │
    │  └──────────────┘       │    └────────┬─────────┘       │
    │                         │             │                 │
    └─────────────────────────┼─────────────┼─────────────────┘
                              │             │ [HTTPS + Encrypted]
                              │             ▼
                              │  ┌───────────────────────────┐
                              │  │ Scaleway Object Storage   │
                              │  │ (Encrypted Backups)       │
                              │  │ 30/90/365 day lifecycle   │
                              │  └───────────────────────────┘
                              │
               SSH to App VM via jump:
               ssh -J deploy@ci.scanorbit.cloud deploy@<app-private-ip>
```

### Two-VM Setup

| VM | Role | Public Access | SSH Access |
|----|------|---------------|------------|
| **App VM** (`scanorbit-prod`) | Docker host for all services | HTTP/HTTPS only | Private network only (via jump) |
| **CI VM** (`scanorbit-ci`) | GitHub runners + SSH jump host | SSH only | `ssh deploy@ci.scanorbit.cloud` |

Both VMs are connected via a **Scaleway Private Network** (10.10.0.0/24). The CI VM serves as the sole SSH entry point — the App VM has no public SSH access.

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
cd terraform/scaleway

# Copy example config
cp terraform.tfvars.example terraform.tfvars

# Edit with your values
vim terraform.tfvars
```

Required variables:
```hcl
domain           = "scanorbit.cloud"
ssh_public_keys  = ["ssh-ed25519 AAAAC3..."]
environment      = "prod"

# CI Runner configuration
ci_instance_type     = "DEV1-M"
github_runner_repos  = ["maxbolgarin/scanorbit", "maxbolgarin/biomaxing"]
github_runner_count  = 3
github_runner_labels = "self-hosted,linux,x64"
```

The GitHub runner token is sensitive and should be set via environment variable:
```bash
export TF_VAR_github_runner_token="ghp_xxxx..."
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

# Key values:
terraform output public_ip              # App VM public IP (web traffic)
terraform output ci_public_ip           # CI VM public IP (SSH entry point)
terraform output app_private_ip         # App VM private IP (for jump SSH)
terraform output ci_private_ip          # CI VM private IP
terraform output backup_bucket_name
terraform output backup_access_key
terraform output -raw backup_secret_key
```

### 4. Verify CI VM and Runners

```bash
# SSH to CI VM
ssh deploy@ci.scanorbit.cloud

# Check runners are registered
# Go to GitHub repo → Settings → Actions → Runners
# You should see 6 runners (3 per repo)

# Test jump SSH to App VM
ssh -J deploy@ci.scanorbit.cloud deploy@10.10.0.3
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

The App VM has **no public SSH**. Copy files via the CI jump host and the app **private** IP:

```bash
APP_IP=$(terraform output -raw app_private_ip)
JUMP="deploy@ci.scanorbit.cloud"   # ci.<domain> from DNS (see dns_records / variable domain)

scp -o ProxyJump=$JUMP deploy/docker-compose.yml deploy/Caddyfile \
    deploy@${APP_IP}:/opt/scanorbit/deploy/

scp -o ProxyJump=$JUMP .env deploy@${APP_IP}:/opt/scanorbit/deploy/
```

Or from the repo root: `make send-deploy-files` (uses `terraform output app_private_ip` and `ci.scanorbit.cloud` by default; override with `APP_PRIVATE_IP` / `CI_SSH_HOST` if needed).

### 6. Generate TLS Certificates

SSH into the App VM via jump (scripts are pre-installed):

```bash
ssh -J deploy@ci.scanorbit.cloud deploy@$(terraform output -raw app_private_ip)

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

### App VM (Production Services)

| Resource | Type | Description |
|----------|------|-------------|
| `scaleway_instance_ip.main` | Reserved IP | Static public IPv4 for web traffic |
| `scaleway_instance_security_group.main` | Firewall | HTTP/HTTPS only (no public SSH) |
| `scaleway_instance_server.main` | DEV1-M VM | Docker host for all services |
| `scaleway_instance_volume` | Block Storage | Encrypted data volume |
| `scaleway_instance_private_nic.app` | Private NIC | Connects App VM to private network |

### CI VM (Runners + Jump Host)

| Resource | Type | Description |
|----------|------|-------------|
| `scaleway_instance_ip.ci` | Reserved IP | Static public IPv4 for SSH |
| `scaleway_instance_security_group.ci` | Firewall | SSH only |
| `scaleway_instance_server.ci` | DEV1-M VM | GitHub runners + jump host |
| `scaleway_instance_private_nic.ci` | Private NIC | Connects CI VM to private network |

### Shared Infrastructure

| Resource | Type | Description |
|----------|------|-------------|
| `scaleway_vpc.main` | VPC | Virtual Private Cloud |
| `scaleway_vpc_private_network.main` | Private Network | 10.10.0.0/24 connecting both VMs |
| `scaleway_object_bucket` | S3 Bucket | Encrypted backup storage |
| `scaleway_object_bucket_policy` | Bucket Policy | Access control |
| `scaleway_iam_application` | IAM App | Backup service account |
| `scaleway_iam_api_key` | API Key | Backup credentials |

### DNS Records

| Record | Type | Target |
|--------|------|--------|
| `scanorbit.cloud` | A | App VM Public IP |
| `www.scanorbit.cloud` | CNAME | scanorbit.cloud |
| `app.scanorbit.cloud` | A | App VM Public IP |
| `api.scanorbit.cloud` | A | App VM Public IP |
| `ci.scanorbit.cloud` | A | CI VM Public IP |

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

# App VM
terraform output public_ip           # App VM public IP (web traffic)
terraform output ssh_command         # Direct SSH (deprecated — use jump)
terraform output domain_url          # https://scanorbit.cloud

# CI VM
terraform output ci_public_ip        # CI VM public IP
terraform output ci_ssh_command      # ssh deploy@ci.scanorbit.cloud

# Private network
terraform output app_private_ip      # App VM private IP (for jump SSH)
terraform output ci_private_ip       # CI VM private IP
terraform output app_ssh_via_jump    # Full jump SSH command

# Backups
terraform output backup_bucket_name
terraform output backup_bucket_endpoint
terraform output -raw backup_secret_key
```

## Maintenance

### SSH Access

The App VM has no public SSH — access it via the CI VM (jump host):

```bash
# Direct SSH to CI VM (runners / jump host)
ssh deploy@ci.scanorbit.cloud

# SSH to App VM via jump host
ssh -J deploy@ci.scanorbit.cloud deploy@<app-private-ip>
# Get the private IP: terraform output app_private_ip
```

**Recommended `~/.ssh/config`:**

```
Host scanorbit-ci
  HostName ci.scanorbit.cloud
  User deploy
  IdentityFile ~/.ssh/id_ed25519

Host scanorbit-app
  HostName <app-private-ip>
  User deploy
  IdentityFile ~/.ssh/id_ed25519
  ProxyJump scanorbit-ci
```

Then simply: `ssh scanorbit-ci` or `ssh scanorbit-app`.

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
| App VM (DEV1-M) | ~€7 |
| CI VM (DEV1-M) | ~€7 |
| Reserved IPs (×2) | ~€6 |
| Block Storage (20GB) | ~€2 |
| Object Storage (~10GB) | ~€1 |
| Private Network | Free |
| DNS | Free |
| **Total** | **~€23/month** |

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

Both VMs are configured with identical SSH hardening (applied via cloud-init):

### SSH Security (Both VMs)

| Setting | Value | Description |
|---------|-------|-------------|
| Login User | `deploy` | Non-root user with sudo access |
| Root Login | **Disabled** | `PermitRootLogin no` |
| Password Auth | **Disabled** | SSH keys only |
| Max Auth Tries | 3 | Limits brute-force attempts |
| Allowed Users | `deploy` | Only deploy user can SSH |
| Ciphers | ChaCha20, AES-256-GCM | Modern algorithms only |

### Automatic Protections (Both VMs)

| Feature | Description |
|---------|-------------|
| **fail2ban** | Blocks IPs after 3 failed SSH attempts (1 hour ban) |
| **Unattended Upgrades** | Security patches applied daily |
| **Strong Ciphers** | Modern cryptographic algorithms only |

### Network Security

| Component | App VM | CI VM |
|-----------|--------|-------|
| **Public SSH** | Disabled | Enabled (jump host) |
| **UFW Firewall** | HTTP/HTTPS + SSH from private network only | SSH only |
| **Security Group** | Ports 80, 443 only | Port 22 only |
| **Private Network** | 10.10.0.0/24 | 10.10.0.0/24 |

The App VM is only reachable via SSH through the CI VM (jump host). Scaleway security groups only apply to public traffic — private network traffic bypasses them, so SSH from CI → App works over the private network.

### Internal Encryption

| Component | Encryption |
|-----------|------------|
| PostgreSQL | TLS 1.2+ with self-signed CA |
| Redis | TLS 1.2+ with password auth |
| Backups | AES-256 GPG encryption |
| Block Storage | Scaleway-managed encryption |

### CI VM: GitHub Runners

- 3 self-hosted runners registered for each configured repository
- Runners run as systemd services under the `deploy` user
- Daily Docker cleanup cron prevents disk fill from CI builds
- Runner labels: `self-hosted,linux,x64`

### Security Audit

Run the built-in security audit script:

```bash
# On App VM (via jump)
ssh -J deploy@ci.scanorbit.cloud deploy@<app-private-ip>
/opt/security-audit.sh
```

This shows:
- SSH configuration status
- fail2ban banned IPs
- Firewall rules
- Recent failed login attempts
- Unattended upgrade status
