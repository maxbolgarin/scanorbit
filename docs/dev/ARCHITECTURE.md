# MVP Plan – AWS Infrastructure Scanner SaaS — ScanOrbit

## 1. Product Scope (MVP)

**Goal:** Agentless AWS scanner that, via read‑only APIs, provides:

1. Cloud inventory (EC2, EBS, RDS, S3, ALB, ACM).
2. Orphaned resources report (EBS, EIP, snapshots).
3. SSL certificates discovery + expiry alerts.
4. Basic data residency check (EU vs non‑EU regions for data‑holding services).

**Tech stack:**

- Landing: **Astro**
- Web app: **React**
- Backend API: **Node.js + TypeScript + Hono**
- DB: **Postgres**
- Cache / jobs coordination: **Redis**
- Workers: **Golang**
- Deployment: **Single EU VM + Docker Compose**, GDPR‑conscious (EU VPS, disk encryption, backups in EU).

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
  - `scanner` – AWS inventory scans.
  - `analyzer` – orphaned resources, SSL, data residency.
- `db` – Postgres.
- `cache` – Redis (job queue, caching session tokens if needed).
- `proxy` – Nginx or Caddy for TLS termination and routing.

### 2.2 Data Flow (MVP)

1. User signs up → creates org → connects AWS account via IAM role ARN.
2. API validates connection using STS `AssumeRole`.
3. Scanner worker pulls jobs from Redis:
   - `ScanAwsAccount(account_id)`.
4. Scanner uses AWS SDK to list resources, writes into Postgres.
5. Analyzer worker runs:
   - `AnalyzeOrphans`, `AnalyzeSsl`, `AnalyzeDataResidency`.
6. React app calls API to display resources & findings.

***

## 3. Data Model (Initial)

### 3.1 Core Tables

- `users`
  - `id`, `email`, `password_hash` (or OAuth provider), `created_at`.
- `orgs`
  - `id`, `name`, `created_at`.
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
/api
  src/
    index.ts           # Hono app entry
    routes/
      auth.ts
      orgs.ts
      aws-accounts.ts
      resources.ts
      findings.ts
    services/
      authService.ts
      awsAccountService.ts
      resourceService.ts
      findingService.ts
    lib/
      db.ts            # Postgres client
      redis.ts         # Redis client
      awsSts.ts        # assumeRole helper
    middlewares/
      authMiddleware.ts
  package.json
  tsconfig.json
```

### 4.2 Key Endpoints (MVP)

- `POST /auth/signup` – create user & org.
- `POST /auth/login` – issue JWT session.
- `GET /me` – current user/org.

- `POST /aws/accounts` – add AWS account (role ARN).
- `GET /aws/accounts` – list accounts.
- `POST /aws/accounts/:id/test` – STS AssumeRole + `DescribeRegions`.

- `GET /resources` – list resources, filter by account/region/service.
- `GET /findings` – list findings, filter by type/severity/account.

Optionally a `POST /aws/accounts/:id/scan` to enqueue manual scan.

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

### Phase 1 (Week 1–2) – Skeleton

- Repo setup with packages: `landing`, `app`, `api`, `workers`.
- Docker Compose with Postgres + Redis.
- API:
  - Auth (simple email/password).
  - Org + AWS account CRUD.
- Test endpoint: `POST /aws/accounts/:id/test` (STS AssumeRole+DescribeRegions).

### Phase 2 (Week 3–4) – Inventory + Orphans

- Implement scanner worker for:
  - EC2, EBS, RDS, S3.
- Implement `resources` table and upsert logic.
- Implement orphan analyzer.
- React UI for resources + orphan findings.

### Phase 3 (Week 5–6) – SSL + Data Residency

- Implement ACM + optional endpoint TLS scan.
- Implement `certificates` table and SSL analyzer.
- Implement data residency analyzer.
- UI: dashboard widgets for expiring certs & violations.

### Phase 4 (Week 7–8) – Hardening & First Users

- Audit logs & basic rate limiting.
- Deploy to EU VPS via Docker Compose.
- Add privacy/security pages.
- Invite 3–5 design partners to onboard.
