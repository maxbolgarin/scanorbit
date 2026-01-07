# ScanOrbit

Agentless AWS Infrastructure Scanner SaaS — discover resources, detect security issues, and ensure compliance.

## Overview

ScanOrbit is a cloud security platform that scans your AWS infrastructure to:

- **Cloud Inventory** — Discover EC2, EBS, RDS, S3, ALB, ACM resources across all regions
- **Orphaned Resources** — Find unattached EBS volumes, unused Elastic IPs, old snapshots
- **SSL Monitoring** — Track certificate expiration with severity-based alerts
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
│  │  │  • EC2      │              │  • Orphans   │               │  │
│  │  │  • EBS      │              │  • SSL       │               │  │
│  │  │  • RDS      │              │  • Residency │               │  │
│  │  │  • S3       │              │              │               │  │
│  │  │  • ALB/ACM  │              │              │               │  │
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
| Backend API | Node.js 22, Hono, Drizzle ORM, TypeScript |
| Workers | Go 1.23, AWS SDK v2 |
| Database | PostgreSQL 17 |
| Cache/Queue | Redis 7 |
| Proxy | Caddy 2 (production) |

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

## Prerequisites

- **Node.js** >= 22.0.0
- **pnpm** >= 9.0.0
- **Go** >= 1.23
- **Docker** & Docker Compose
- **AWS Account** (for testing)

## Quick Start (Development)

### 1. Clone and Install

```bash
git clone https://github.com/maxbolgarin/scanorbit.git
cd scanorbit

# Install dependencies
make install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your settings (defaults work for local development)
```

### 3. Start Infrastructure

```bash
# Start PostgreSQL and Redis
make dev-infra

# Run database migrations
make db-migrate
```

### 4. Start Services

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

### 5. Access Services

| Service | URL |
|---------|-----|
| React App | http://localhost:3000 |
| Landing Page | http://localhost:4321 |
| API | http://localhost:4000 |
| API Health | http://localhost:4000/health |

## Environment Variables

### Required for All Environments

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgres://scanorbit:scanorbit@localhost:5432/scanorbit` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `JWT_SECRET` | Secret for JWT signing | (required in production) |

### API Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | API server port | `4000` |
| `NODE_ENV` | Environment mode | `development` |
| `JWT_EXPIRY` | JWT token expiration | `7d` |
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

## Production Deployment

### 1. Prepare Environment

```bash
# Create production .env file
cp .env.example .env.prod

# Edit with production values:
# - Strong JWT_SECRET (generate with: openssl rand -base64 32)
# - Strong POSTGRES_PASSWORD
# - Proper DATABASE_URL and REDIS_URL
```

### 2. Build and Deploy

```bash
# Build all images
make docker-build

# Deploy with production configuration
make docker-prod
```

### 3. Run Migrations

```bash
# Connect to API container and run migrations
docker exec -it scanorbit-api pnpm db:migrate
```

### 4. Configure Domain

Update `docker/Caddyfile` with your domain:

```caddyfile
{
    email your-email@example.com
}

yourdomain.com {
    # Landing page (static files)
    reverse_proxy landing:80

    # React app
    handle /app/* {
        reverse_proxy app:80
    }

    # API
    handle /api/* {
        reverse_proxy api:4000
    }
}
```

### 5. AWS IAM Role Setup

Users need to create an IAM role in their AWS account for ScanOrbit to assume:

**Trust Policy:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::YOUR_SCANORBIT_ACCOUNT:root"
      },
      "Action": "sts:AssumeRole",
      "Condition": {
        "StringEquals": {
          "sts:ExternalId": "USER_GENERATED_EXTERNAL_ID"
        }
      }
    }
  ]
}
```

**Permission Policy (Read-Only):**
```json
{
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
        "rds:DescribeDBInstances",
        "rds:DescribeDBSnapshots",
        "s3:ListAllMyBuckets",
        "s3:GetBucketLocation",
        "s3:GetBucketTagging",
        "elasticloadbalancing:DescribeLoadBalancers",
        "elasticloadbalancing:DescribeTags",
        "acm:ListCertificates",
        "acm:DescribeCertificate"
      ],
      "Resource": "*"
    }
  ]
}
```

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
- `GET /auth/me` — Current user

### Organizations
- `GET /orgs` — List organizations
- `GET /orgs/:id` — Get organization
- `PATCH /orgs/:id` — Update organization
- `GET /orgs/:id/members` — List members

### AWS Accounts
- `GET /aws/accounts` — List AWS accounts
- `POST /aws/accounts` — Add AWS account
- `GET /aws/accounts/:id` — Get AWS account
- `DELETE /aws/accounts/:id` — Remove AWS account
- `POST /aws/accounts/:id/test` — Test connection
- `POST /aws/accounts/:id/scan` — Trigger scan
- `GET /aws/accounts/:id/scans` — Scan history

### Resources
- `GET /resources` — List resources (paginated)
- `GET /resources/:id` — Get resource details
- `GET /resources/stats` — Resource statistics
- `GET /resources/regions` — List regions
- `GET /resources/services` — List services

### Findings
- `GET /findings` — List findings (paginated)
- `GET /findings/:id` — Get finding details
- `GET /findings/stats` — Finding statistics
- `PATCH /findings/:id` — Update finding status
- `POST /findings/bulk-update` — Bulk update status

## Testing Infrastructure

A Terraform configuration is provided to create test AWS infrastructure with intentional issues:

```bash
cd terraform

# Initialize
terraform init

# Review what will be created
terraform plan

# Deploy test infrastructure
terraform apply

# After testing, clean up
terraform destroy
```

See `terraform/README.md` for details on the test resources created.

## Security Considerations

- **Read-Only Access** — ScanOrbit only requires read permissions
- **Role Assumption** — Uses IAM roles with external ID, no stored credentials
- **EU Data Residency** — Deploy on EU VPS for GDPR compliance
- **Encrypted Storage** — Enable disk encryption on production servers
- **Secure Secrets** — Use strong, unique JWT secrets in production

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
