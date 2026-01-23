# ScanOrbit – AWS Infrastructure Scanner SaaS Architecture

## 1. Product Overview

**Goal:** Agentless AWS scanner that, via read‑only APIs, provides:

1. Cloud inventory (EC2, EBS, RDS, S3, ALB, ACM, IAM, Lambda, KMS, Secrets Manager).
2. Orphaned resources report (EBS, EIP, snapshots).
3. SSL certificates discovery + expiry alerts.
4. Security analysis (permissive security groups, public access, encryption).
5. IAM security analysis (MFA, access keys, overly permissive policies).
6. Cost optimization (stopped instances, unused resources).
7. Tagging compliance (required tags enforcement).
8. Data residency check (EU vs non‑EU regions for GDPR compliance).

**Tech Stack:**

| Component | Technology | Version |
|-----------|------------|---------|
| Landing | Astro + Tailwind CSS | 5.x, 4.x |
| Web App | React + React Router + TanStack Query + Zustand | 19.x, 7.x |
| Backend API | Node.js + TypeScript + Hono + Drizzle ORM | 24.x |
| Database | PostgreSQL | 17.x |
| Cache/Queue | Redis | 7.x |
| Workers | Go + AWS SDK v2 + pgx + zerolog | 1.24.x |
| Authentication | JWT + OAuth (Google/GitHub) + 2FA (TOTP) | - |
| Payments | Stripe | - |
| Deployment | Docker Compose, Scaleway | - |

***

## 2. Architecture Overview

### 2.1 High‑Level Components

- `landing` – static marketing site (Astro).
- `app` – React SPA (or React in Astro islands) for logged‑in users.
- `api` – Hono HTTP API (Node+TS) for:
  - Auth, user/org management.
  - AWS account onboarding.
  - Serving resources & findings.
- `workers` – Go services:
  - `scanner` – AWS inventory scans (EC2, EBS, RDS, S3, ALB, ACM, IAM, Lambda, KMS, Secrets Manager).
  - `analyzer` – orphaned resources, SSL, data residency, security, cost, tagging, IAM analysis.
- `db` – Postgres.
- `cache` – Redis (job queue, caching session tokens if needed).
- `proxy` – Nginx or Caddy for TLS termination and routing.

### 2.2 Data Flow (MVP)

1. User signs up → creates org → connects AWS account via IAM role ARN.
2. API validates connection using STS `AssumeRole`.
3. Scanner worker pulls jobs from Redis:
   - `ScanAwsAccount(account_id)`.
4. Scanner uses AWS SDK to list resources, writes into Postgres.
5. Analyzer worker runs multiple analysis jobs:
   - `AnalyzeOrphans`, `AnalyzeSsl`, `AnalyzeDataResidency`
   - `AnalyzeSecurity`, `AnalyzeCost`, `AnalyzeTagging`, `AnalyzeIAM`
6. React app calls API to display resources & findings.
7. Optional: User configures 2FA, OAuth login, Stripe subscription.

***

## 3. Data Model (Initial)

### 3.1 Core Tables

- `users`
  - `id`, `email`, `password_hash` (or OAuth provider), `created_at`
  - `totp_secret` (encrypted), `totp_enabled`, `recovery_codes` (2FA)
  - `google_id`, `github_id` (OAuth)
  - `stripe_customer_id` (billing)
- `orgs`
  - `id`, `name`, `slug`, `created_at`
  - `tier` (free, pro, team), `stripe_subscription_id`
- `user_org_members`
  - `user_id`, `org_id`, `role`.

- `aws_accounts`
  - `id`
  - `org_id`
  - `name`
  - `aws_account_id`
  - `role_arn`
  - `external_id` (optional, for STS)
  - `status` (`pending`, `ok`, `error`)
  - `last_scan_at`, `created_at`, `updated_at`.

- `resources`
  - `id`
  - `org_id`
  - `aws_account_id`
  - `region`
  - `service` (`ec2`, `ebs`, `rds`, `s3`, `alb`, etc.)
  - `resource_id` (ARN or provider ID)
  - `name`
  - `state`
  - `tags` (JSONB)
  - `cost_estimate_monthly` (nullable)
  - `last_seen_at`
  - `raw` (JSONB for provider payload).

- `certificates`
  - `id`
  - `org_id`
  - `aws_account_id`
  - `source` (`acm`, `endpoint_scan`)
  - `identifier` (ARN or fingerprint)
  - `primary_domain`
  - `alt_names` (JSONB)
  - `not_before`, `not_after`
  - `issuer`
  - `last_seen_at`.

- `findings`
  - `id`
  - `org_id`
  - `aws_account_id`
  - `resource_id` (nullable, FK to `resources`)
  - `certificate_id` (nullable)
  - `type` (`orphaned_volume`, `orphaned_eip`, `ssl_expiry`, `data_residency_violation`)
  - `severity` (`low`, `medium`, `high`)
  - `summary`
  - `details` (JSONB)
  - `created_at`, `resolved_at` (nullable).

- `jobs`
  - `id`
  - `type` (`scan_account`, `analyze_orphans`, etc.)
  - `payload` (JSONB)
  - `status` (`queued`, `running`, `done`, `error`)
  - `created_at`, `updated_at`.

***

## 4. Backend API (Node + TS + Hono)

### 4.1 Project Structure

```txt
apps/api/
  src/
    index.ts           # Hono app entry
    routes/
      index.ts         # Route aggregation
      auth.ts          # Authentication, 2FA, OAuth, password reset
      orgs.ts          # Organizations, members, settings
      aws-accounts.ts  # AWS accounts CRUD
      aws-scans.ts     # Scan management
      resources.ts     # Resources, dependencies
      findings.ts      # Findings, bulk actions
      gdpr.ts          # GDPR compliance endpoints
      stripe.ts        # Stripe billing webhooks
    services/
      authService.ts
      awsAccountService.ts
      orgService.ts
      resourceService.ts
      findingService.ts
      twoFactorService.ts
      emailService.ts
      stripeService.ts
      consentService.ts
      retentionService.ts
    lib/
      db.ts            # Drizzle client
      redis.ts         # ioredis client
      jwt.ts           # jose JWT helpers
      crypto.ts        # Encryption helpers
      config.ts        # Environment config
      errors.ts        # Error classes
    db/
      schema.ts        # Drizzle schema definitions
    middlewares/
      auth.ts
      errorHandler.ts
      rateLimit.ts
      requestId.ts
      structuredLogger.ts
    types/
      index.ts
  package.json
  tsconfig.json
  drizzle.config.cjs
```

### 4.2 Key Endpoints

**Authentication:**
- `POST /auth/signup` – create user & org
- `POST /auth/login` – issue JWT session
- `GET /auth/me` – current user/org
- `POST /auth/2fa/*` – 2FA setup, verify, disable
- `GET /auth/google`, `GET /auth/github` – OAuth flows
- `POST /auth/forgot-password`, `POST /auth/reset-password` – password reset

**AWS Management:**
- `POST /aws/accounts` – add AWS account (role ARN)
- `GET /aws/accounts` – list accounts
- `POST /aws/accounts/:id/test` – STS AssumeRole test
- `POST /aws/accounts/:id/scan` – trigger scan
- `POST /aws/accounts/:id/analyze` – trigger analysis

**Resources & Findings:**
- `GET /resources` – list resources, filter by account/region/service
- `GET /resources/:id/dependencies` – resource dependencies
- `GET /findings` – list findings, filter by type/severity/account
- `PATCH /findings/:id` – update finding status

**Billing:**
- `POST /stripe/checkout` – create checkout session
- `POST /stripe/webhook` – handle Stripe events

**GDPR:**
- `GET /gdpr/export` – data export (Article 20)
- `POST /gdpr/delete` – deletion request (Article 17)

***

## 5. Workers (Go)

### 5.1 Scanner Worker (`scanner`)

Responsibilities:

- Poll Redis or DB for `scan_account` jobs.
- For each job:
  1. Fetch `aws_accounts` record (role_arn, external_id).
  2. Assume role with AWS STS.
  3. List regions.
  4. For each region:
     - `DescribeInstances` → EC2
     - `DescribeVolumes` → EBS
     - `DescribeDBInstances` → RDS
     - `ListBuckets` (once globally) → S3
     - (Optionally) describe ALBs, ACM certs.
  5. Upsert into `resources` and `certificates`.
  6. Update `aws_accounts.last_scan_at`.

Implementation outline:

- Go modules:
  - `internal/awsclient` – wrapper over AWS SDK for listing resources.
  - `internal/store` – Postgres DB access.
  - `internal/queue` – Redis consumer/producer.

### 5.2 Analyzer Worker (`analyzer`)

Responsibilities:

- Poll jobs of types:
  - `analyze_orphans`
  - `analyze_ssl`
  - `analyze_data_residency`.

Implement simple analyzers:

- **Orphans**
  - EBS: `state="available"` & age > N days → `orphaned_volume`.
  - EIP: not associated to any instance/LB → `orphaned_eip`.
- **SSL**
  - `not_after < now + 60 days` → `ssl_expiry`.
- **Data residency**
  - Services: RDS/S3.
  - Region ∉ allowed list (`eu-west-1`, `eu-central-1`, `eu-north-1`) → `data_residency_violation`.

Each analyzer reads `resources` / `certificates`, writes `findings`.

***

## 6. Frontend

### 6.1 Landing (Astro)

Pages:

- `/` – Product story, features, screenshots.
- `/privacy` – GDPR‑oriented privacy note.
- `/security` – Explain read‑only, no SSH, data residency.

Include clear CTA: “Login” to app subpath (e.g. `/app` or separate subdomain).

### 6.2 Web App (React)

You can either:

- Use Astro as shell and React islands for app pages, or
- Host React as a separate app served by Nginx.

Views:

1. **Onboarding**
   - Connect AWS: form with `account name`, `aws_account_id`, `role_arn`.
   - Show IAM policy + trust policy snippet.

2. **Dashboard**
   - Cards:
     - Total resources discovered.
     - Orphaned resources found.
     - Certificates expiring <60 days.
     - Data residency violations.

3. **Resources list**
   - Table: service, region, state, tags.

4. **Findings list**
   - Filter by type/severity/account.
   - Link to related resource.

***

## 7. Docker Compose Production Setup

### 7.1 Compose Layout

`docker-compose.yml` (base for dev) plus `docker-compose.prod.yml` with overrides.[1][2]

Services:

- `proxy` – Nginx/Caddy (TLS, HTTP → app/api).
- `landing` – Astro static site (served via proxy or built into proxy image).
- `api` – Node+TS app.
- `app` – React SPA (or combined with `landing`).
- `scanner-worker` – Go binary.
- `analyzer-worker` – Go binary.
- `db` – Postgres (with volume).
- `redis` – Redis.

Production changes (in `docker-compose.prod.yml`):

- Remove source code bind mounts.
- Set `restart: always`.
- Configure minimal logging.
- Point to production environment variables (DB creds, JWT secret, etc.).[3][1]

### 7.2 Cheap GDPR‑friendly VM

- Use EU VPS (e.g. Netherlands / Germany) advertised as GDPR‑compliant:  
  - Bit Hosting NL, Hetzner, or other NL VPS providers.[4][5][6][7]
- Encrypt disk (provider feature or OS‑level LUKS).
- Ensure:
  - VM location: EU only (Amsterdam, Frankfurt, etc.).
  - Backups stored in same region/EU.[7][4]

### 7.3 Operational Basics

- Set up:

  - Firewall (only 80/443 open).
  - Fail2ban or similar intrusion protection.
  - Daily `pg_dump` to encrypted storage (EU).

- Use separate env files:
  - `.env.prod` not in git.

***

## 8. Implementation Phases

### Phase 1 – Core Infrastructure

- Repo setup with packages: `apps/landing`, `apps/app`, `apps/api`, `workers`.
- Docker Compose with Postgres + Redis.
- API:
  - Auth (email/password with JWT).
  - Org + AWS account CRUD.
- Test endpoint: `POST /aws/accounts/:id/test` (STS AssumeRole+DescribeRegions).

### Phase 2 – Inventory + Orphans

- Implement scanner worker for:
  - EC2, EBS, RDS, S3.
- Implement `resources` table and upsert logic.
- Implement orphan analyzer.
- React UI for resources + orphan findings.

### Phase 3 – SSL + Data Residency

- Implement ACM + optional endpoint TLS scan.
- Implement `certificates` table and SSL analyzer.
- Implement data residency analyzer.
- UI: dashboard widgets for expiring certs & violations.

### Phase 4 – Hardening & Production

- Audit logs & basic rate limiting.
- Deploy to EU VPS via Docker Compose.
- Add privacy/security pages.
- Invite design partners to onboard.
