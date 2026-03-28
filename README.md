# ScanOrbit

![CI](https://github.com/maxbolgarin/scanorbit/actions/workflows/ci.yml/badge.svg)

Agentless AWS Infrastructure Scanner SaaS — discover resources, detect security issues, and ensure compliance.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Production Deployment](#production-deployment)
  - [CI/CD Architecture](#cicd-architecture)
  - [Infrastructure Setup](#1-infrastructure-setup-scaleway)
  - [GitHub Repository Setup](#2-github-repository-setup)
  - [Prepare Environment File](#3-prepare-environment-file)
  - [Copy Deployment Files](#4-copy-deployment-files-to-server)
  - [Generate TLS Certificates](#5-generate-tls-certificates)
  - [Start Services](#6-start-services)
  - [Auto-Updates with Watchtower](#7-auto-updates-with-watchtower)
  - [Monitoring & Logs](#8-monitoring--logs)
- [Development Setup](#development-setup)
  - [Prerequisites](#prerequisites)
  - [Quick Start](#quick-start)
- [Git Flow & Release Cycle](#git-flow--release-cycle)
  - [Branches](#branches)
  - [Workflow](#workflow)
  - [Development Flow](#development-flow)
  - [Release Flow](#release-flow)
  - [Commit Convention](#commit-convention)
  - [CI/CD Pipelines](#cicd-pipelines)
- [Project Structure](#project-structure)
- [Environment Variables](#environment-variables)
- [Available Commands](#available-commands)
- [API Endpoints](#api-endpoints)
- [Testing](#testing)
- [Security Considerations](#security-considerations)
- [Troubleshooting](#troubleshooting)
- [License](#license)

## Additional Documentation

- [Scaleway Deployment Guide](deploy/scaleway/README.md) — Detailed infrastructure deployment instructions
- [GDPR Compliance Guide](docs/gdpr-compliance.md) — Data protection, backups, retention policies
- [Test Infrastructure Guide](deploy/test/README.md) — AWS test resources setup

## Overview

ScanOrbit is a cloud security platform that scans your AWS infrastructure to:

- **Cloud Inventory** — Discover EC2, EBS, RDS, S3, ALB, ACM, Lambda, IAM, KMS, and Secrets Manager resources across all regions
- **Orphaned Resources** — Find unattached EBS volumes, unused Elastic IPs, old snapshots
- **SSL Monitoring** — Track certificate expiration with severity-based alerts
- **Security Analysis** — Detect permissive security groups, public access, unencrypted resources
- **IAM Security** — Identify users without MFA, old access keys, overly permissive policies
- **Cost Optimization** — Find stopped instances, unused resources, and rightsizing opportunities
- **Tagging Compliance** — Ensure resources have required organizational tags
- **Data Residency** — Ensure GDPR compliance by detecting resources outside EU regions

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ScanOrbit Platform                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                          │
│  │ Landing  │  │   App    │  │   API    │                          │
│  │ (Astro)  │  │ (React)  │  │ (Hono)   │                          │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                          │
│       │             │             │                                 │
│       └─────────────┴─────────────┘                                 │
│                     │                                               │
│              ┌──────┴──────┐                                        │
│              │   Caddy     │  (TLS termination, routing)            │
│              └─────────────┘                                        │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    Background Workers (Go)                    │  │
│  │  ┌─────────────┐              ┌──────────────┐               │  │
│  │  │   Scanner   │              │   Analyzer   │               │  │
│  │  │  • EC2/EBS  │              │  • Orphans   │               │  │
│  │  │  • RDS/S3   │              │  • SSL       │               │  │
│  │  │  • ALB/ACM  │              │  • Residency │               │  │
│  │  │  • IAM      │              │  • Security  │               │  │
│  │  │  • Lambda   │              │  • Cost      │               │  │
│  │  │  • KMS      │              │  • Tagging   │               │  │
│  │  │  • Secrets  │              │  • IAM       │               │  │
│  │  └──────┬──────┘              └──────┬───────┘               │  │
│  └─────────┼───────────────────────────┼────────────────────────┘  │
│            │                           │                            │
│       ┌────┴───────────────────────────┴────┐                      │
│       │              Redis Queue             │                      │
│       └──────────────────┬───────────────────┘                      │
│                          │                                          │
│       ┌──────────────────┴───────────────────┐                      │
│       │            PostgreSQL DB             │                      │
│       └──────────────────────────────────────┘                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Component | Technology |
|-----------|------------|
| Landing Page | Astro 5, Tailwind CSS 4 |
| Web App | React 19, React Router 7, TanStack Query, Zustand |
| Backend API | Node.js 24, Hono, Drizzle ORM, TypeScript |
| Workers | Go 1.24, AWS SDK v2 |
| Database | PostgreSQL 17 |
| Cache/Queue | Redis 7 |
| Proxy | Caddy 2 (production) |

## Production Deployment

ScanOrbit uses **GitHub Container Registry (GHCR)** with **Watchtower** for automatic deployments.

### CI/CD Architecture

```
Push to main → GitHub Actions builds images → Pushes to GHCR → Watchtower pulls & restarts
```

| Component | Role |
|-----------|------|
| GitHub Actions | Builds Docker images on push to `main` |
| GHCR | Stores container images (`ghcr.io/org/scanorbit-*`) |
| Watchtower | Auto-pulls new images every 5 minutes |
| Caddy | Reverse proxy with automatic Let's Encrypt TLS |

### 1. Infrastructure Setup (Scaleway)

```bash
cd terraform/scaleway

# Configure variables
cp terraform.tfvars.example terraform.tfvars
vim terraform.tfvars  # Set domain, ssh_public_keys, runner config, etc.

# Set GitHub PAT for runner registration
export TF_VAR_github_runner_token="ghp_xxxx..."

# Deploy infrastructure
terraform init
terraform apply

# Note the outputs
terraform output ci_public_ip       # CI VM (SSH entry point)
terraform output app_private_ip     # App VM private IP (for jump SSH)
```

This creates two VMs connected via a private network:

| VM | Role | Public Access |
|----|------|---------------|
| App VM | Docker host (all services) | HTTP/HTTPS only |
| CI VM | GitHub runners + SSH jump host | SSH only |

DNS records (created automatically by Terraform):

| Record | Type | Target |
|--------|------|--------|
| `scanorbit.cloud` | A | App VM Public IP |
| `www.scanorbit.cloud` | CNAME | scanorbit.cloud |
| `app.scanorbit.cloud` | A | App VM Public IP |
| `api.scanorbit.cloud` | A | App VM Public IP |
| `ci.scanorbit.cloud` | A | CI VM Public IP |

SSH access: `ssh deploy@ci.scanorbit.cloud` (CI VM), then jump to App VM via private network.

### 2. GitHub Repository Setup

1. **Enable GitHub Packages**
   - Go to **Settings → Actions → General**
   - Enable "Read and write permissions" for `GITHUB_TOKEN`

2. **Add Repository Variables** (Settings → Secrets and variables → Actions → Variables)
   - `VITE_PUBLIC_API_URL` = `https://api.scanorbit.cloud`
   - Optional `PROD_DEPLOY_JUMP_HOST` — set to `ci.scanorbit.cloud` only if deploy jobs do **not** run on the self-hosted CI VM (see `deploy/README.md`).

3. **Add Action secrets for deploy** — `PROD_DEPLOY_HOST` (app **private** IP from `terraform output -raw app_private_ip`), `PROD_DEPLOY_USER`, `PROD_DEPLOY_SSH_KEY`. Details: `deploy/README.md` Step 2.

4. **Push to main** — GitHub Actions will build and push images to GHCR

### 3. Prepare Environment File

On your local machine, configure the environment file:

```bash
cp .env.example .env
vim .env  # Set all required values (see Environment Variables section)

# Key GDPR-related variables to configure:
# - REDIS_PASSWORD (strong password)
# - BACKUP_ENCRYPTION_KEY (openssl rand -hex 32)
# - SCW_ACCESS_KEY, SCW_SECRET_KEY, SCW_BUCKET_NAME (from terraform output)
```

### 4. Copy Deployment Files to Server

Copy only the required files (scripts are pre-installed via Terraform cloud-init).
The App VM has no public SSH — use jump through CI VM:

```bash
# With ~/.ssh/config ProxyJump configured (see terraform/scaleway/README.md):
scp deploy/docker-compose.yml deploy/Caddyfile \
    scanorbit-app:/opt/scanorbit/deploy/

scp .env scanorbit-app:/opt/scanorbit/deploy/

# Or with explicit jump:
scp -o ProxyJump=deploy@ci.scanorbit.cloud \
    deploy/docker-compose.yml deploy/Caddyfile \
    deploy@<app-private-ip>:/opt/scanorbit/deploy/
```

### 5. Generate TLS Certificates

SSH into the App VM via jump host and generate certificates (scripts are pre-installed):

```bash
ssh -J deploy@ci.scanorbit.cloud deploy@<app-private-ip>
# Or: ssh scanorbit-app  (with ~/.ssh/config)

cd /opt/scanorbit/deploy
./scripts/generate-certs.sh

# This creates:
# - certs/postgres/ (CA + server cert for PostgreSQL SSL)
# - certs/redis/ (CA + server cert for Redis TLS)
```

### 6. Start Services

```bash
# Login to GitHub Container Registry
# Create PAT at: https://github.com/settings/tokens (scope: read:packages)
echo 'YOUR_GITHUB_PAT' | docker login ghcr.io -u YOUR_USERNAME --password-stdin

# Start all services (migrations run automatically before API starts)
docker compose -f docker-compose.yml up -d

# Verify all services are healthy
docker compose -f docker-compose.yml ps

# Check GDPR components are running
docker compose -f docker-compose.yml logs postgres-backup
docker compose -f docker-compose.yml logs retention-cleanup
```

### 7. Auto-Updates with Watchtower

Watchtower runs inside Docker Compose and automatically:
- Polls GHCR every 5 minutes for new images
- Pulls and restarts containers with new versions
- Performs rolling restarts (zero downtime)

**Manual deploy** (if needed):
```bash
cd /opt/scanorbit
docker compose -f docker-compose.yml pull
docker compose -f docker-compose.yml up -d
```
### 8. Monitoring & Logs

```bash
# View all logs
docker compose -f docker-compose.yml logs -f

# View specific service
docker compose -f docker-compose.yml logs -f api

# Check Watchtower activity
docker compose -f docker-compose.yml logs -f watchtower

# GDPR: Check backup status
docker compose -f docker-compose.yml logs postgres-backup

# GDPR: Check retention cleanup
docker compose -f docker-compose.yml logs retention-cleanup

# Service status
docker compose -f docker-compose.yml ps
```


## Development Setup

### Prerequisites

- **Node.js** >= 24.0.0
- **pnpm** >= 9.0.0
- **Go** >= 1.24
- **Docker** & Docker Compose
- **AWS Account** (for testing)

### Quick Start

#### 1. Clone and Install

```bash
git clone https://github.com/maxbolgarin/scanorbit.git
cd scanorbit

# Install dependencies
make install
```

#### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your settings (defaults work for local development)
```

#### 3. Start Infrastructure

```bash
# Start PostgreSQL and Redis
make dev-infra

# Run database migrations
make db-migrate
```

#### 4. Start Services

**Option A: All services via Docker**
```bash
make docker-up
```

**Option B: Individual services for development**
```bash
# Terminal 1 - API
make dev-api

# Terminal 2 - React App
make dev-app

# Terminal 3 - Landing Page
make dev-landing

# Terminal 4 - Scanner Worker
make dev-scanner

# Terminal 5 - Analyzer Worker
make dev-analyzer
```

#### 5. Access Services

| Service | URL |
|---------|-----|
| React App | http://localhost:3000 |
| Landing Page | http://localhost:4321 |
| API | http://localhost:4000 |
| API Health | http://localhost:4000/health |

## Git Flow & Release Cycle

ScanOrbit follows a **Git Flow** branching strategy with **semantic versioning**.

### Branches

| Branch | Purpose | Image Tag |
|--------|---------|-----------|
| `main` | Production releases | `latest`, `v1.2.3` |
| `develop` | Development integration | `develop`, `dev-<sha>` |
| `feature/*` | New features | - |
| `fix/*` | Bug fixes | - |

### Workflow

```
feature/xyz ──┐
              │
fix/abc ──────┼──► develop ──► main ──► v1.2.3 (release)
              │        │
feature/123 ──┘        │
                       ▼
                  Build images
                  (develop tag)
```

### Development Flow

1. **Create feature branch** from `develop`:
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/my-feature
   ```

2. **Make changes** and commit using conventional commits:
   ```bash
   git commit -m "feat(api): add user authentication"
   git commit -m "fix(app): resolve login redirect issue"
   ```

3. **Push and create PR** to `develop`:
   ```bash
   git push origin feature/my-feature
   # Create PR: feature/my-feature → develop
   ```

4. **Merge to develop** — triggers build with `develop` tag

### Release Flow

1. **Create PR** from `develop` to `main`

2. **Merge to main** — triggers:
   - Semantic Release analyzes commits
   - Creates version tag (e.g., `v1.2.3`)
   - Generates CHANGELOG.md
   - Creates GitHub Release
   - Builds images with version tag + `latest`

3. **Watchtower** auto-deploys `latest` to production

### Commit Convention

| Type | Description | Version Bump |
|------|-------------|--------------|
| `feat` | New feature | Minor (0.X.0) |
| `fix` | Bug fix | Patch (0.0.X) |
| `perf` | Performance improvement | Patch |
| `refactor` | Code refactoring | Patch |
| `docs` | Documentation | None |
| `style` | Code style | None |
| `test` | Tests | None |
| `chore` | Maintenance | None |
| `BREAKING CHANGE` | Breaking change | Major (X.0.0) |

### CI/CD Pipelines

| Workflow | Trigger | Actions |
|----------|---------|---------|
| `ci.yml` | All branches, PRs | Lint, typecheck, test, build check |
| `develop.yml` | Push to `develop` | Build images with `develop` tag |
| `deploy.yml` | Push to `main` | Semantic release, build images with version |

## Project Structure

```
scanorbit/
├── apps/
│   ├── api/          # Hono backend API (TypeScript)
│   ├── app/          # React frontend application
│   └── landing/      # Astro marketing site
├── workers/          # Go background workers
│   ├── cmd/
│   │   ├── scanner/  # AWS resource scanner
│   │   └── analyzer/ # Security analyzer
│   └── internal/
│       ├── awsclient/  # AWS SDK wrappers
│       ├── store/      # Database access
│       ├── queue/      # Redis job queue
│       ├── scanner/    # Scanning logic
│       ├── analyzers/  # Analysis rules
│       └── models/     # Data models
├── terraform/        # Test infrastructure
├── docker/           # Docker configurations
└── docs/             # Documentation
```

## Environment Variables

### Required for All Environments

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgres://scanorbit:scanorbit@localhost:5432/scanorbit` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `JWT_SECRET` | Secret for access token signing (5 min expiry) | (required in production) |
| `JWT_REFRESH_SECRET` | Secret for refresh token signing (7 day expiry) | (required in production) |
| `TOTP_ENCRYPTION_KEY` | 2FA TOTP encryption key (`openssl rand -hex 32`) | (required in production) |
| `OAUTH_ENCRYPTION_KEY` | OAuth token encryption key (`openssl rand -hex 32`) | (required in production) |

### API Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | API server port | `4000` |
| `NODE_ENV` | Environment mode | `development` |
| `FRONTEND_URL` | Frontend URL for CORS | `http://localhost:3000` |
| `LOG_LEVEL` | Logging level | `info` |

### Worker Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `LOG_LEVEL` | Logging level | `info` |
| `SCAN_CONCURRENCY` | Max concurrent region scans | `10` |
| `SHUTDOWN_TIMEOUT_SECONDS` | Graceful shutdown timeout | `30` |

### AWS Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `AWS_REGION` | Default AWS region | `eu-central-1` |
| `AWS_ACCESS_KEY_ID` | AWS access key (for local dev) | - |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key (for local dev) | - |

### Database Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `POSTGRES_USER` | PostgreSQL username | `scanorbit` |
| `POSTGRES_PASSWORD` | PostgreSQL password | `scanorbit` |
| `POSTGRES_DB` | PostgreSQL database name | `scanorbit` |

### OAuth Configuration (Optional)

| Variable | Description | Default |
|----------|-------------|---------|
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | - |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret | - |
| `GOOGLE_CALLBACK_URL` | Google OAuth callback URL | `https://api.yourdomain.com/auth/google/callback` |
| `GITHUB_CLIENT_ID` | GitHub OAuth Client ID | - |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth Client Secret | - |
| `GITHUB_CALLBACK_URL` | GitHub OAuth callback URL | `https://api.yourdomain.com/auth/github/callback` |

### Stripe Configuration (Optional)

| Variable | Description | Default |
|----------|-------------|---------|
| `STRIPE_SECRET_KEY` | Stripe API secret key | - |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | - |
| `STRIPE_PRO_PRICE_ID` | Price ID for Pro tier | - |
| `STRIPE_TEAM_PRICE_ID` | Price ID for Team tier | - |
| `STRIPE_TRIAL_DAYS` | Trial period in days | `7` |

### Email Configuration (Optional)

| Variable | Description | Default |
|----------|-------------|---------|
| `SMTP_ENABLED` | Enable SMTP email sending | `false` |
| `SMTP_HOST` | SMTP server host | - |
| `SMTP_PORT` | SMTP server port | `465` |
| `SMTP_SECURE` | Use SSL/TLS | `true` |
| `SMTP_USER` | SMTP username | - |
| `SMTP_PASS` | SMTP password | - |
| `SMTP_FROM` | From address for emails | - |

### Alerting Configuration (Optional)

| Variable | Description | Default |
|----------|-------------|---------|
| `SLACK_WEBHOOK_URL` | Slack webhook for Alertmanager | - |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token for alerts | - |
| `TELEGRAM_CHAT_ID` | Telegram chat ID for alerts | - |
| `WATCHTOWER_NOTIFICATION_URL` | Watchtower notification URL | - |

### GDPR Compliance (Production)

| Variable | Description | Default |
|----------|-------------|---------|
| `REDIS_PASSWORD` | Redis password (required for TLS) | - |
| `BACKUP_ENCRYPTION_KEY` | AES-256 key for backups (`openssl rand -hex 32`) | - |
| `SCW_ACCESS_KEY` | Scaleway access key for S3 backups | - |
| `SCW_SECRET_KEY` | Scaleway secret key for S3 backups | - |
| `SCW_BUCKET_NAME` | S3 bucket name for backups | `scanorbit-backups` |
| `SCW_REGION` | Scaleway region | `nl-ams` |
| `RETENTION_RESOURCES_DAYS` | Days to keep stale resources | `90` |
| `RETENTION_FINDINGS_RESOLVED_DAYS` | Days to keep resolved findings | `180` |
| `RETENTION_SCANS_DAYS` | Days to keep scan records | `365` |
| `RETENTION_AUDIT_LOGS_DAYS` | Days to keep audit logs | `730` |

## Available Commands

### Development

| Command | Description |
|---------|-------------|
| `make install` | Install all dependencies |
| `make dev` | Start all TypeScript services |
| `make dev-infra` | Start PostgreSQL and Redis |
| `make dev-api` | Start API in dev mode |
| `make dev-app` | Start React app in dev mode |
| `make dev-landing` | Start landing page in dev mode |
| `make dev-scanner` | Run scanner worker |
| `make dev-analyzer` | Run analyzer worker |

### Build

| Command | Description |
|---------|-------------|
| `make build` | Build all services |
| `make build-ts` | Build TypeScript services only |
| `make build-go` | Build Go workers only |

### Docker

| Command | Description |
|---------|-------------|
| `make docker-up` | Start all services |
| `make docker-down` | Stop all services |
| `make docker-build` | Build Docker images |
| `make docker-prod` | Start production deployment |
| `make docker-logs` | Follow container logs |

### Database

| Command | Description |
|---------|-------------|
| `make db-migrate` | Run database migrations |
| `make db-generate` | Generate migrations from schema |

### Quality

| Command | Description |
|---------|-------------|
| `make test` | Run all tests |
| `make lint` | Run linters |
| `make typecheck` | TypeScript type checking |
| `make clean` | Clean build artifacts |

## API Endpoints

### Authentication
- `POST /auth/signup` — Create account
- `POST /auth/login` — Login
- `POST /auth/logout` — Logout
- `POST /auth/refresh` — Refresh access token
- `GET /auth/me` — Current user
- `PATCH /auth/profile` — Update user profile
- `POST /auth/change-password` — Change password
- `POST /auth/forgot-password` — Request password reset
- `POST /auth/reset-password` — Reset password with token
- `POST /auth/verify-email` — Verify email address
- `POST /auth/resend-verification` — Resend verification email
- `POST /auth/switch-org` — Switch organization context

### Two-Factor Authentication (2FA)
- `POST /auth/2fa/setup/init` — Initialize 2FA setup (returns QR code)
- `POST /auth/2fa/setup/verify` — Complete 2FA setup
- `POST /auth/2fa/verify` — Verify 2FA code during login
- `POST /auth/2fa/verify-recovery` — Verify with recovery code
- `POST /auth/2fa/disable` — Disable 2FA
- `GET /auth/2fa/status` — Get 2FA status
- `POST /auth/2fa/recovery-codes/regenerate` — Regenerate recovery codes

### OAuth Authentication
- `GET /auth/google` — Initiate Google OAuth
- `GET /auth/google/callback` — Google OAuth callback
- `POST /auth/google/token` — Exchange Google token
- `GET /auth/github` — Initiate GitHub OAuth
- `GET /auth/github/callback` — GitHub OAuth callback

### Organizations
- `GET /orgs` — List organizations
- `POST /orgs` — Create organization
- `GET /orgs/:id` — Get organization
- `PATCH /orgs/:id` — Update organization
- `GET /orgs/:id/members` — List members
- `GET /orgs/:id/settings` — Get organization settings
- `PATCH /orgs/:id/settings` — Update organization settings
- `GET /orgs/:id/subscription` — Get subscription details
- `POST /orgs/:id/subscription/upgrade` — Upgrade subscription

### AWS Accounts
- `GET /aws/accounts` — List AWS accounts
- `POST /aws/accounts` — Add AWS account
- `GET /aws/accounts/:id` — Get AWS account
- `PATCH /aws/accounts/:id` — Update AWS account
- `DELETE /aws/accounts/:id` — Remove AWS account
- `POST /aws/accounts/:id/test` — Test connection
- `POST /aws/accounts/:id/scan` — Trigger scan
- `POST /aws/accounts/:id/analyze` — Trigger analysis
- `GET /aws/accounts/:id/scans` — Scan history
- `PATCH /aws/accounts/:id/scanners` — Update enabled scanners

### Resources
- `GET /resources` — List resources (paginated)
- `GET /resources/:id` — Get resource details
- `PATCH /resources/:id` — Update resource (tags)
- `GET /resources/stats` — Resource statistics
- `GET /resources/regions` — List regions
- `GET /resources/services` — List services
- `GET /resources/health` — Get resource health metrics
- `GET /resources/:id/dependencies` — Get resource dependencies
- `GET /resources/:id/dependents` — Get dependent resources
- `GET /resources/:id/finding-timeline` — Get finding history for resource
- `GET /resources/:id/scan-history` — Get scan history for resource
- `GET /resources/dependencies/all` — Get all dependencies
- `GET /resources/dependencies/stats` — Get dependency statistics

### Findings
- `GET /findings` — List findings (paginated)
- `GET /findings/:id` — Get finding details
- `GET /findings/:id/history` — Get finding status history
- `GET /findings/stats` — Finding statistics
- `PATCH /findings/:id` — Update finding status
- `POST /findings/bulk-update` — Bulk update status

### Stripe Billing
- `POST /stripe/checkout` — Create checkout session
- `POST /stripe/portal` — Create customer portal session
- `POST /stripe/webhook` — Stripe webhook handler

### GDPR Compliance
- `GET /gdpr/export` — Export user's personal data (Article 20)
- `POST /gdpr/delete` — Request account deletion (Article 17)
- `DELETE /gdpr/delete/:id` — Cancel deletion request
- `GET /gdpr/deletion-status` — Check deletion request status
- `GET /gdpr/audit-logs` — View user's audit logs

### Health & Metrics
- `GET /health` — Health check
- `GET /status` — Detailed service status
- `GET /metrics` — Prometheus metrics

## Testing

### Step 1: Set Up AWS Credentials for Local Development

For local testing, you need AWS credentials that ScanOrbit workers can use.

**Option A: Use IAM User (simpler for testing)**

1. Create an IAM user in your AWS account:
   ```bash
   aws iam create-user --user-name scanorbit-test-user
   ```

2. Attach the read-only policy:
   ```bash
   aws iam put-user-policy --user-name scanorbit-test-user --policy-name ScanOrbitReadOnly --policy-document '{
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "ec2:DescribeInstances",
           "ec2:DescribeVolumes",
           "ec2:DescribeAddresses",
           "ec2:DescribeRegions",
           "ec2:DescribeSnapshots",
           "ec2:DescribeSecurityGroups",
           "rds:DescribeDBInstances",
           "rds:DescribeDBSnapshots",
           "s3:ListAllMyBuckets",
           "s3:GetBucketLocation",
           "s3:GetBucketTagging",
           "s3:GetBucketPublicAccessBlock",
           "elasticloadbalancing:DescribeLoadBalancers",
           "elasticloadbalancing:DescribeTags",
           "acm:ListCertificates",
           "acm:DescribeCertificate",
           "iam:ListUsers",
           "iam:GetUser",
           "iam:ListAccessKeys",
           "iam:GetAccessKeyLastUsed",
           "iam:ListMFADevices",
           "iam:ListRoles",
           "iam:GetRole",
           "iam:ListRolePolicies",
           "iam:ListAttachedRolePolicies",
           "iam:GetPolicy",
           "iam:GetPolicyVersion",
           "lambda:ListFunctions",
           "lambda:GetFunction",
           "kms:ListKeys",
           "kms:DescribeKey",
           "kms:GetKeyRotationStatus",
           "secretsmanager:ListSecrets",
           "secretsmanager:DescribeSecret",
           "cloudwatch:GetMetricData",
           "logs:DescribeLogGroups"
         ],
         "Resource": "*"
       }
     ]
   }'
   ```

3. Create access keys:
   ```bash
   aws iam create-access-key --user-name scanorbit-test-user
   ```

4. Add credentials to your `.env` file:
   ```env
   AWS_ACCESS_KEY_ID=AKIA...
   AWS_SECRET_ACCESS_KEY=...
   AWS_REGION=eu-central-1
   ```

**Option B: Use IAM Role with AssumeRole (production-like)**

1. Create an IAM role with the trust policy (replace `YOUR_AWS_ACCOUNT_ID`):
   ```bash
   aws iam create-role --role-name ScanOrbitTestRole --assume-role-policy-document '{
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Principal": {
           "AWS": "arn:aws:iam::YOUR_AWS_ACCOUNT_ID:root"
         },
         "Action": "sts:AssumeRole",
         "Condition": {
           "StringEquals": {
             "sts:ExternalId": "scanorbit-test-external-id"
           }
         }
       }
     ]
   }'
   ```

2. Attach the permission policy:
   ```bash
   aws iam put-role-policy --role-name ScanOrbitTestRole --policy-name ScanOrbitReadOnly --policy-document '{
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "ec2:DescribeInstances",
           "ec2:DescribeVolumes",
           "ec2:DescribeAddresses",
           "ec2:DescribeRegions",
           "ec2:DescribeSnapshots",
           "ec2:DescribeSecurityGroups",
           "rds:DescribeDBInstances",
           "rds:DescribeDBSnapshots",
           "s3:ListAllMyBuckets",
           "s3:GetBucketLocation",
           "s3:GetBucketTagging",
           "s3:GetBucketPublicAccessBlock",
           "elasticloadbalancing:DescribeLoadBalancers",
           "elasticloadbalancing:DescribeTags",
           "acm:ListCertificates",
           "acm:DescribeCertificate",
           "iam:ListUsers",
           "iam:GetUser",
           "iam:ListAccessKeys",
           "iam:GetAccessKeyLastUsed",
           "iam:ListMFADevices",
           "iam:ListRoles",
           "iam:GetRole",
           "iam:ListRolePolicies",
           "iam:ListAttachedRolePolicies",
           "iam:GetPolicy",
           "iam:GetPolicyVersion",
           "lambda:ListFunctions",
           "lambda:GetFunction",
           "kms:ListKeys",
           "kms:DescribeKey",
           "kms:GetKeyRotationStatus",
           "secretsmanager:ListSecrets",
           "secretsmanager:DescribeSecret",
           "cloudwatch:GetMetricData",
           "logs:DescribeLogGroups"
         ],
         "Resource": "*"
       }
     ]
   }'
   ```

3. Use credentials that can assume the role in `.env`:
   ```env
   AWS_ACCESS_KEY_ID=AKIA...
   AWS_SECRET_ACCESS_KEY=...
   AWS_REGION=eu-central-1
   ```

### Step 2: Deploy Test Infrastructure (Optional)

A Terraform configuration creates AWS resources with intentional issues for ScanOrbit to detect:

| Resource | Issue Type | Expected Finding |
|----------|-----------|------------------|
| EC2 Instance (orphaned) | Missing tags | Untagged resource |
| EBS Volume (orphaned) | Not attached | Orphaned volume |
| Elastic IP | Not associated | Unused EIP (cost waste) |
| Security Group | 0.0.0.0/0 ingress | Open to world |
| S3 Bucket (untagged) | No tags | Untagged resource |
| S3 Bucket (US region) | Non-EU region | GDPR violation |
| EBS Snapshot (old) | Stale snapshot | Cost optimization |

```bash
cd deploy/test

# Initialize Terraform
terraform init

# Review the plan
terraform plan

# Deploy test resources (~$30-50/month if left running)
terraform apply

# Note the outputs - you'll need the Account ID
```

### Step 3: Configure ScanOrbit

1. Start the application:
   ```bash
   make dev-infra
   make db-migrate
   make docker-up
   ```

2. Create an account via the UI at http://localhost:3000 or via API:
   ```bash
   curl -X POST http://localhost:4000/auth/signup \
     -H "Content-Type: application/json" \
     -d '{
       "email": "test@example.com",
       "password": "password123",
       "name": "Test User"
     }'
   ```

3. Login and get a token:
   ```bash
   TOKEN=$(curl -s -X POST http://localhost:4000/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email": "test@example.com", "password": "password123"}' \
     | jq -r '.token')
   ```

4. Add your AWS account (replace with your Account ID and Role ARN):
   ```bash
   curl -X POST http://localhost:4000/aws/accounts \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer $TOKEN" \
     -d '{
       "name": "Test AWS Account",
       "accountId": "123456789012",
       "roleArn": "arn:aws:iam::123456789012:role/ScanOrbitTestRole",
       "externalId": "scanorbit-test-external-id"
     }'
   ```

### Step 4: Run a Scan

1. Trigger a scan:
   ```bash
   # Get the AWS account ID from the previous response
   AWS_ACCOUNT_UUID="..."

   curl -X POST "http://localhost:4000/aws/accounts/$AWS_ACCOUNT_UUID/scan" \
     -H "Authorization: Bearer $TOKEN"
   ```

2. Monitor scan progress:
   ```bash
   # Check worker logs
   docker logs -f scanorbit-scanner
   docker logs -f scanorbit-analyzer
   ```

3. View results:
   ```bash
   # List discovered resources
   curl "http://localhost:4000/resources" \
     -H "Authorization: Bearer $TOKEN" | jq

   # List findings
   curl "http://localhost:4000/findings" \
     -H "Authorization: Bearer $TOKEN" | jq

   # Get statistics
   curl "http://localhost:4000/findings/stats" \
     -H "Authorization: Bearer $TOKEN" | jq
   ```

### Step 5: Clean Up Test Resources

```bash
cd terraform
terraform destroy

# Also remove the IAM user if created
aws iam delete-access-key --user-name scanorbit-test-user --access-key-id AKIA...
aws iam delete-user-policy --user-name scanorbit-test-user --policy-name ScanOrbitReadOnly
aws iam delete-user --user-name scanorbit-test-user
```

### Expected Test Results

After scanning the Terraform-created infrastructure, you should see findings like:

| Finding Type | Severity | Resource |
|--------------|----------|----------|
| `orphaned_volume` | Medium | EBS volume not attached to any instance |
| `orphaned_eip` | Low | Elastic IP not associated (costs $3.65/month) |
| `missing_tag` | Trivial | EC2 instance missing required tags |
| `missing_tag` | Trivial | S3 bucket missing tags |
| `permissive_security_group` | High | Security group allows 0.0.0.0/0 |
| `data_residency_violation` | High | S3 bucket in us-east-1 (GDPR violation) |
| `user_without_mfa` | High | IAM user without MFA enabled |
| `old_access_key` | Medium | IAM access key older than 90 days |

See `deploy/test/README.md` for more details on test resources.

## Security Considerations

### Infrastructure Security
- **Read-Only Access** — ScanOrbit only requires read permissions to scan AWS
- **Role Assumption** — Uses IAM roles with external ID, no stored credentials
- **SSH Hardening** — Root disabled, key-only auth, strong ciphers, fail2ban on both VMs
- **Network Isolation** — App VM has no public SSH; accessible only via jump through CI VM over private network
- **Firewall** — App VM: HTTP/HTTPS only. CI VM: SSH only. Private network for inter-VM communication

### GDPR Compliance
- **EU Data Residency** — Deployed in Amsterdam (nl-ams) region
- **Encryption at Rest** — Encrypted block storage for all data
- **Encryption in Transit** — TLS for PostgreSQL, Redis, and external traffic
- **Automated Backups** — Daily encrypted backups to S3 with 30/90/365 day retention
- **Audit Logging** — All API requests logged with user, action, timestamp, IP
- **Data Retention** — Automatic cleanup of stale data per configurable policies
- **Right to Erasure** — API for account deletion with 30-day grace period
- **Right to Portability** — API for complete data export in JSON format

### Best Practices
- **Secure Secrets** — Use strong, unique JWT secrets in production
- **TLS Certificates** — Generate internal certificates before deployment
- **Backup Encryption** — Use strong AES-256 key for backup encryption

## Troubleshooting

### Database Connection Issues

```bash
# Check PostgreSQL is running
docker ps | grep scanorbit-db

# Check logs
docker logs scanorbit-db

# Verify connection
docker exec -it scanorbit-db psql -U scanorbit -d scanorbit
```

### Redis Connection Issues

```bash
# Check Redis is running
docker ps | grep scanorbit-redis

# Test connection
docker exec -it scanorbit-redis redis-cli ping
```

### Worker Issues

```bash
# Check worker logs
docker logs scanorbit-scanner
docker logs scanorbit-analyzer

# Verify Redis queue
docker exec -it scanorbit-redis redis-cli LLEN jobs:scan_account
```

### AWS Connection Issues

1. Verify IAM role ARN format: `arn:aws:iam::ACCOUNT_ID:role/ROLE_NAME`
2. Check trust policy allows your ScanOrbit account
3. Verify external ID matches
4. Ensure role has required permissions

## License

UNLICENSED — Private software
