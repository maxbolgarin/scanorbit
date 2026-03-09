# ScanOrbit — Production Deployment Guide

Complete guide to deploy ScanOrbit from scratch on a Scaleway VM.

## Architecture Overview

```
Internet
  │
  ├── :80/:443 ──► Caddy (reverse proxy, auto TLS)
  │                  ├── scanorbit.cloud      ──► Landing (Astro/nginx)
  │                  ├── app.scanorbit.cloud   ──► App (React SPA/nginx)
  │                  └── api.scanorbit.cloud   ──► API (Node.js/Hono)
  │
  └── Internal Docker network (172.21.0.0/16)
       ├── PostgreSQL 17 (TLS, encrypted backups to Scaleway S3)
       ├── Redis 7 (TLS + password)
       ├── Scanner Worker (Go) — scans AWS accounts
       ├── Analyzer Worker (Go) — analyzes scan results
       ├── Watchtower ──► Docker Socket Proxy (auto-deploy from GHCR)
       ├── Prometheus + Grafana + Loki (monitoring, localhost only)
       ├── Umami (analytics, localhost only)
       └── Listmonk (newsletter, localhost only)
```

**Secrets** are stored as Docker secret files (`/run/secrets/`), never in env vars or `docker inspect`.

**CI/CD**: Push to `main` → GitHub Actions builds Docker images → GHCR → Watchtower auto-pulls.


## Prerequisites

- Scaleway account with a domain managed in Scaleway DNS
- GitHub repository with Actions enabled and GHCR packages
- Terraform installed locally
- SSH key pair (`ssh-keygen -t ed25519`)
- AWS account (for scanning target accounts)


## Step 1: Provision Infrastructure with Terraform

```bash
cd terraform/scaleway

# Copy and fill in your values
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars:
#   - scw_zone, scw_region (e.g., nl-ams-1, nl-ams for GDPR)
#   - instance_type (DEV1-M = 3 vCPU, 4GB RAM, ~€7/mo)
#   - domain (your domain managed in Scaleway DNS)
#   - admin_email (for Let's Encrypt)
#   - ssh_public_keys (your public key content)

terraform init
terraform plan
terraform apply
```

This creates:
- VM instance with Docker, fail2ban, UFW, SSH hardening
- DNS records: `scanorbit.cloud`, `www`, `app`, `api`
- S3 bucket for encrypted backups
- IAM API key for backup operations

Save the outputs:
```bash
terraform output              # public IP, SSH command, backup keys
terraform output -raw backup_secret_key  # save this for secrets setup
```


## Step 2: Configure GitHub Actions

In your GitHub repo, set these **repository variables** (Settings → Secrets and variables → Actions → Variables):

| Variable | Value |
|---|---|
| `VITE_API_URL` | `https://api.scanorbit.cloud` |
| `VITE_SCANORBIT_AWS_ACCOUNT_ID` | Your AWS account ID |

GitHub Actions uses `GITHUB_TOKEN` (automatic) for GHCR authentication. No additional secrets needed.

### First build

Push to `main` or trigger the Release workflow manually. This builds and pushes Docker images to GHCR:
- `ghcr.io/<org>/scanorbit/api:latest`
- `ghcr.io/<org>/scanorbit/app:latest`
- `ghcr.io/<org>/scanorbit/landing:latest`
- `ghcr.io/<org>/scanorbit/scanner:latest`
- `ghcr.io/<org>/scanorbit/analyzer:latest`


## Step 3: Authenticate Docker on the VM

SSH into the VM and authenticate with GHCR so Docker can pull private images:

```bash
ssh deploy@scanorbit.cloud

# Create a GitHub Personal Access Token (PAT) with read:packages scope
# Then login:
echo "ghp_YOUR_TOKEN" | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```


## Step 4: Generate TLS Certificates

Internal TLS certificates for PostgreSQL and Redis (not public-facing — Caddy handles public TLS):

```bash
# On the VM:
cd /opt/scanorbit/deploy
chmod +x scripts/generate-certs.sh
./scripts/generate-certs.sh
```

This creates `certs/postgres/` and `certs/redis/` with CA, server cert, and key.

> Certificates are valid for 365 days. Set a reminder to regenerate.


## Step 5: Deploy Configuration Files

From your local machine:

```bash
# Send all deploy files
make send-deploy-files

# This runs:
#   scp -r deploy/ deploy@scanorbit.cloud:/opt/scanorbit/
#   scp deploy/docker-compose.prod.yml deploy@scanorbit.cloud:/opt/scanorbit/deploy/docker-compose.yml
#   scp .env.prod deploy@scanorbit.cloud:/opt/scanorbit/deploy/.env
```

Or individually:
```bash
make send-docker-compose  # just docker-compose.yml
make send-caddyfile       # just Caddyfile
make send-env             # just .env
```


## Step 6: Set Up Docker Secrets

Secrets are stored as individual files in `deploy/secrets/`, mounted into containers at `/run/secrets/`.

### Option A: From a secrets file (recommended)

```bash
ssh deploy@scanorbit.cloud
cd /opt/scanorbit/deploy

# Copy the template and fill in your values
cp secrets.env.example secrets.env
nano secrets.env

# Run the setup script
chmod +x scripts/setup-secrets.sh
./scripts/setup-secrets.sh secrets.env

# DELETE the secrets file immediately
rm -f secrets.env
```

### Option B: Interactive mode

```bash
./scripts/setup-secrets.sh
# Prompts for each secret value
```

### Secrets reference

Generate strong values with `openssl rand -hex 32`.

| Secret | How to get it |
|---|---|
| `POSTGRES_PASSWORD` | `openssl rand -hex 32` |
| `DATABASE_URL` | `postgresql://scanorbit:<POSTGRES_PASSWORD>@postgres:5432/scanorbit?sslmode=require` |
| `REDIS_PASSWORD` | `openssl rand -hex 32` |
| `REDIS_URL` | `rediss://:<REDIS_PASSWORD>@redis:6379` |
| `JWT_SECRET` | `openssl rand -hex 32` |
| `JWT_REFRESH_SECRET` | `openssl rand -hex 32` |
| `TOTP_ENCRYPTION_KEY` | `openssl rand -hex 32` |
| `OAUTH_ENCRYPTION_KEY` | `openssl rand -hex 32` |
| `GOOGLE_CLIENT_SECRET` | Google Cloud Console → APIs & Services → Credentials |
| `GITHUB_CLIENT_SECRET` | GitHub → Settings → Developer settings → OAuth Apps |
| `STRIPE_SECRET_KEY` | Stripe Dashboard → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard → Developers → Webhooks |
| `AWS_ACCESS_KEY_ID` | AWS IAM → Create access key |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM → Create access key |
| `SMTP_PASS` | Your SMTP provider (e.g., Scaleway TEM) |
| `BACKUP_ENCRYPTION_KEY` | `openssl rand -hex 32` |
| `SCW_ACCESS_KEY` | `terraform output backup_access_key` |
| `SCW_SECRET_KEY` | `terraform output -raw backup_secret_key` |

### Verify secrets

```bash
ls -la /opt/scanorbit/deploy/secrets/
# Should show 18 files, all with 600 permissions
```


## Step 7: Set File Permissions

```bash
ssh deploy@scanorbit.cloud
cd /opt/scanorbit/deploy

# .env should not be world-readable
chmod 600 .env

# Secrets directory
chmod 700 secrets/
chmod 600 secrets/*

# Helper and entrypoint scripts must be executable
chmod +x scripts/*.sh entrypoints/*.sh
```


## Step 8: Start Services

```bash
ssh deploy@scanorbit.cloud
cd /opt/scanorbit/deploy

# Pull images and start everything
docker compose up -d

# Watch startup progress
docker compose logs -f --tail=50

# Check health
docker compose ps
```

### Startup order (handled automatically by `depends_on`):

1. `postgres` → healthy
2. `redis` → healthy
3. `umami-db-init`, `listmonk-db-init` → create databases
4. `migrate` → run DB migrations
5. `listmonk-init` → install schema
6. `api`, `scanner`, `analyzer` → start
7. `caddy` → start (auto-provisions TLS certificates)
8. `app`, `landing` → start
9. Monitoring stack: `loki` → `prometheus` → `alertmanager` → `grafana` → `promtail`
10. `watchtower` + `docker-socket-proxy` → start


## Step 9: Verify Deployment

```bash
# Health checks
curl https://scanorbit.cloud          # Landing page
curl https://app.scanorbit.cloud      # React SPA
curl https://api.scanorbit.cloud/health  # API health

# Verify secrets are NOT in docker inspect
docker inspect api | grep -i "jwt\|password\|secret"
# Should show NO secret values in Environment section

# Verify secrets ARE mounted
docker exec api cat /run/secrets/jwt_secret
# Should print the secret value

# Check all services are healthy
docker compose ps
```


## Day-to-Day Operations

### Deployments (automatic)

Push to `main` → GitHub Actions builds images → GHCR → Watchtower pulls and restarts (within 5 minutes).

### Manual deployment

```bash
# On VM
cd /opt/scanorbit/deploy
docker compose pull api scanner analyzer app landing
docker compose up -d
```

### Update configuration

```bash
# From local machine
make send-env              # update .env
make send-docker-compose   # update docker-compose.yml
make send-caddyfile        # update Caddyfile

# On VM — restart affected services
cd /opt/scanorbit/deploy
docker compose up -d       # recreates changed services
```

### View logs

```bash
# On VM
docker compose logs -f api         # API logs
docker compose logs -f scanner     # Scanner logs
docker compose logs -f analyzer    # Analyzer logs

# From local machine (via Grafana/Loki)
make tunnel-grafana   # open http://localhost:3001
```

### SSH tunnels to internal services

```bash
make tunnel-grafana       # Grafana    → localhost:3001
make tunnel-umami         # Umami      → localhost:3002
make tunnel-listmonk      # Listmonk   → localhost:9000
```

### Database operations

```bash
# On VM
cd /opt/scanorbit/deploy

# Manual backup
docker compose exec postgres-backup /usr/local/bin/backup.sh

# List available backups
docker compose exec postgres-backup /usr/local/bin/restore.sh --list

# Restore a backup (interactive, with confirmation)
docker compose exec postgres-backup /usr/local/bin/restore.sh daily/scanorbit_20240115_020000.sql.gz.gpg
```

### Redis CLI

```bash
# On VM
cd /opt/scanorbit/deploy
docker compose exec redis redis-cli \
  --tls --cert /data/certs/redis.crt \
  --key /data/certs/redis.key \
  --cacert /data/certs/ca.crt \
  -a "$(cat secrets/redis_password)"
```

### Renew internal TLS certificates

```bash
# On VM (certificates are valid for 365 days)
cd /opt/scanorbit/deploy
./scripts/generate-certs.sh

# Restart services that use TLS
docker compose restart postgres redis api scanner analyzer
```


## Monitoring

All monitoring services bind to `127.0.0.1` only — access via SSH tunnel.

| Service | Local port | Tunnel command |
|---|---|---|
| Grafana | 3001 | `make tunnel-grafana` |
| Prometheus | 9092 | `ssh -N -L 9092:localhost:9092 deploy@scanorbit.cloud` |
| Loki | 3100 | `ssh -N -L 3100:localhost:3100 deploy@scanorbit.cloud` |
| Alertmanager | 9093 | `ssh -N -L 9093:localhost:9093 deploy@scanorbit.cloud` |
| Umami | 3002 | `make tunnel-umami` |
| Listmonk | 9000 | `make tunnel-listmonk` |

### Metrics endpoints (internal)

| Service | Endpoint |
|---|---|
| API | `http://api:4000/metrics` |
| Scanner | `http://scanner:9090/metrics` |
| Analyzer | `http://analyzer:9091/metrics` |
| PostgreSQL Exporter | `http://postgres-exporter:9187/metrics` |
| Redis Exporter | `http://redis-exporter:9121/metrics` |


## Backups

Automated daily backups at 02:00 UTC. Encrypted with GPG (AES-256) and uploaded to Scaleway S3.

| Type | Schedule | Retention |
|---|---|---|
| Daily | Every day | 30 days |
| Weekly | Sundays | 90 days |
| Monthly | 1st of month | 365 days |

GDPR data retention cleanup runs daily at 03:00 UTC:
- Stale resources: 90 days
- Resolved findings: 180 days
- Scan records: 365 days
- Audit logs: 730 days


## Security

- **VM**: SSH key-only auth, fail2ban, UFW (22/80/443 only), auto security updates
- **Docker**: Socket proxy for Watchtower (no direct socket access), isolated internal network
- **Secrets**: Docker secret files (`/run/secrets/`), never in env vars or process listings
- **TLS**: Caddy auto-TLS for public, self-signed certs for internal PostgreSQL/Redis
- **DB**: Password auth + TLS required, no public port exposure
- **Monitoring**: All dashboards on `127.0.0.1` only, accessed via SSH tunnel


## Troubleshooting

### Services won't start
```bash
docker compose logs migrate    # check migration errors
docker compose logs postgres   # check DB startup
docker compose logs redis      # check Redis startup
```

### Caddy can't get TLS certificate
```bash
docker compose logs caddy      # check ACME errors
# Ensure DNS records point to the VM IP
# Ensure ports 80/443 are open (ufw status)
```

### Watchtower not pulling updates
```bash
docker compose logs watchtower
# Check GHCR auth: docker pull ghcr.io/<org>/scanorbit/api:latest
# Re-login: echo "TOKEN" | docker login ghcr.io -u USER --password-stdin
```

### Secret not found errors
```bash
ls -la /opt/scanorbit/deploy/secrets/   # check files exist
docker compose config                     # check secrets section resolves
```

### Internal TLS errors
```bash
# Regenerate certificates
./scripts/generate-certs.sh
docker compose restart postgres redis api scanner analyzer
```


## File Structure

```
deploy/
├── docker-compose.prod.yml    # Main compose file (→ docker-compose.yml on VM)
├── Caddyfile                  # Reverse proxy config
├── redis.conf                 # Redis production config
├── prometheus.yml             # Prometheus scrape config
├── alertmanager.yml           # Alert routing (Slack/Telegram)
├── loki.yml                   # Log aggregation config
├── promtail.yml               # Log collection config
├── secrets.env.example        # Template for Docker secrets
├── Makefile                   # Operations shortcuts
├── certs/                     # Internal TLS certificates (generated)
│   ├── postgres/              # CA + server cert/key
│   └── redis/                 # CA + server cert/key + DH params
├── secrets/                   # Docker secret files (gitignored)
├── grafana/provisioning/      # Grafana datasource/dashboard provisioning
├── prometheus/rules/          # Alerting rules
├── scripts/
│   ├── setup-secrets.sh       # Create secret files from template
│   ├── generate-certs.sh      # Generate internal TLS certs
│   ├── backup.sh              # Encrypted PostgreSQL backup
│   ├── restore.sh             # Restore from encrypted backup
│   └── crontab                # Backup schedule
└── entrypoints/
    ├── secret-entrypoint.sh   # Generic: export secrets as env vars
    ├── pg-exporter-entrypoint.sh
    ├── pg-init-entrypoint.sh
    ├── umami-entrypoint.sh
    ├── listmonk-entrypoint.sh
    ├── backup-entrypoint.sh
    └── alertmanager-entrypoint.sh
```
