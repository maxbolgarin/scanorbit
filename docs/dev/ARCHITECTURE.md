# ScanOrbit – AWS Infrastructure Scanner SaaS Architecture

## 1. Product Overview

**Goal:** Agentless AWS scanner that, via read-only APIs, provides:

1. Cloud inventory (EC2, EBS, RDS, S3, ALB, ACM, IAM, Lambda, KMS, Secrets Manager, CloudWatch, Security Groups).
2. Orphaned resources report (EBS volumes, EIPs, snapshots, ENIs, idle load balancers, unused security groups, idle NAT gateways).
3. SSL certificates discovery + expiry alerts.
4. Security analysis (permissive security groups, public access, encryption, open ports).
5. IAM security analysis (MFA, access keys, unused roles).
6. Cost optimization (stopped instances, unused resources, old-gen instances, oversized Lambda, EBS optimization, RDS optimization).
7. Tagging compliance (required tags enforcement).
8. Data residency check (EU vs non-EU regions for GDPR compliance).

**Tech Stack:**

| Component | Technology | Version |
|-----------|------------|---------|
| Landing | Astro + Tailwind CSS | 5.x, 4.x |
| Web App | React + React Router + TanStack Query + Zustand | 19.x, 7.x |
| Backend API | Node.js + TypeScript + Hono + Drizzle ORM | 25.x |
| Database | PostgreSQL | 17.x |
| Cache/Queue | Redis | 7.x |
| Workers | Go + AWS SDK v2 + pgx + zerolog | 1.24.x |
| Authentication | JWT (jose) + OAuth (Google/GitHub) + 2FA (TOTP) | — |
| Payments | Stripe | 20.x |
| Email (Transactional) | Nodemailer + Resend | — |
| Email (Marketing) | Resend + internal subscriber service | — |
| Reverse Proxy | Caddy | — |
| Monitoring | Prometheus + Grafana + Loki + Alertmanager | — |
| Deployment | Docker Compose, Scaleway | — |

---

## 2. Architecture Overview

### 2.1 High-Level Components

- `landing` – static marketing site (Astro).
- `app` – React SPA for logged-in users.
- `api` – Hono HTTP API (Node+TS) for:
  - Auth (email/password, OAuth, 2FA), user/org management.
  - AWS account onboarding, scan/analysis orchestration.
  - Resources, findings, dependencies serving.
  - Stripe billing, GDPR compliance, newsletter.
- `workers` – Go services:
  - `scanner` – AWS inventory scans across 11 service types.
  - `analyzer` – 7 specialized analyzers (orphans, SSL, residency, security, cost, tagging, IAM).
- `db` – PostgreSQL (17 tables).
- `cache` – Redis (job queue, rate limiting, refresh token store, 2FA setup cache).
- `proxy` – Caddy for TLS termination, automatic Let's Encrypt, and subdomain routing.
- `monitoring` – Prometheus + Grafana + Loki + Promtail + Alertmanager for observability.

### 2.2 Data Flow

1. User signs up (multi-step: send-code → verify-code → complete-signup) → creates org → connects AWS account via IAM role ARN.
2. API validates connection using STS `AssumeRole`.
3. Scanner worker pulls `scan_account` jobs from Redis queue.
4. Scanner uses AWS SDK to list resources across all regions, upserts into `resources` and `certificates` tables.
5. Analyzer worker runs 7 analysis jobs sequentially:
   - `analyze_orphans`, `analyze_ssl`, `analyze_residency`, `analyze_security`, `analyze_cost`, `analyze_tagging`, `analyze_iam`
6. Each analyzer reads resources/certificates, writes/updates `findings` with detection tracking.
7. React app calls API to display resources, findings, dependencies, and analytics.
8. Optional: User configures 2FA, OAuth login, Stripe subscription.

---

## 3. Data Model

### 3.1 Core Tables

- `users`
  - `id`, `email`, `password_hash` (nullable for OAuth-only users), `full_name`, `created_at`, `updated_at`
  - `email_verified`, `email_verification_code`, `email_verification_expires_at`
  - `two_factor_enabled`, `two_factor_secret` (AES-256-GCM encrypted), `two_factor_recovery_codes` (encrypted)
  - `processing_restricted`, `processing_restricted_at` (GDPR Article 18)

- `user_oauth_accounts` (separate table for OAuth providers)
  - `id`, `user_id`, `provider` (google/github), `provider_user_id`, `provider_email`
  - `access_token`, `refresh_token` (encrypted at rest), `token_expires_at`, `raw_profile`

- `orgs`
  - `id`, `name`, `slug`, `logo_url`, `created_at`, `updated_at`
  - `tier` (free/pro/team), `tier_upgraded_at`
  - `stripe_customer_id`, `stripe_subscription_id`, `subscription_status`, `trial_ends_at`, `subscription_ends_at`

- `user_org_members`
  - `user_id`, `org_id`, `role` (admin/member), `title` (devops/cto/developer/security/personal/other)
  - Unique: (user_id, org_id)

- `org_settings`
  - `org_id`, `required_tags` (text[]), `hidden_finding_types` (text[]), `hide_trivial` (boolean)

### 3.2 AWS Infrastructure Tables

- `aws_accounts`
  - `id`, `org_id`, `name`, `aws_account_id` (12 digits), `role_arn`, `external_id`
  - `status` (pending/ok/error), `last_error`, `last_scan_at`
  - `enabled_scanners` (JSONB array: ec2, rds, s3, alb, acm, lambda, cloudwatch, iam, security_groups, secrets_manager, kms)
  - Unique: (org_id, aws_account_id)

- `scans`
  - `id`, `org_id`, `aws_account_id`
  - `status` (queued/processing/running/analyzing/complete/partial/error/canceled)
  - `has_key`, `started_at`, `completed_at`
  - `resources_discovered`, `resources_delta`, `findings_new`, `findings_resolved`, `error_message`

- `resources`
  - `id`, `org_id`, `aws_account_id`, `resource_id` (ARN), `service`, `region`, `name`, `state`
  - `tags` (JSONB), `cost_estimate_monthly`, `last_seen_at`, `raw` (JSONB)
  - Unique: (org_id, aws_account_id, resource_id)

- `resource_dependencies`
  - `source_resource_id`, `target_resource_id` (ARN), `target_service`
  - `relationship_type` (uses_role, in_vpc, in_subnet, uses_sg, attached_to, targets, owns, uses_layer, encrypted_by)

- `resource_scans` — resource-to-scan audit trail (new/updated/removed)

- `certificates`
  - `identifier` (ARN or fingerprint), `source` (acm/endpoint_scan)
  - `primary_domain`, `alt_names`, `not_before`, `not_after`, `issuer`, `algorithm`

### 3.3 Findings

- `findings`
  - `id`, `org_id`, `aws_account_id`, `resource_id` (nullable), `certificate_id` (nullable)
  - `type` (see FINDINGS.md for all 36+ types), `severity` (critical/high/medium/low/trivial)
  - `summary`, `details` (JSONB), `status` (open/resolved/snoozed/ignored)
  - `resolved_at`, `snoozed_until`
  - `first_detected_at`, `last_detected_at`, `detection_count`, `last_scan_id`

- `finding_scans` — finding-to-scan detection tracking (detected/not_detected per scan)

### 3.4 Background Jobs

- `jobs`
  - `type` (scan_account, analyze_orphans, analyze_ssl, analyze_residency, analyze_security, analyze_cost, analyze_tagging, analyze_iam)
  - `status` (queued/running/complete/error), `payload` (JSONB), `result` (JSONB)
  - `recovery_count`, `scan_id`

- `dead_letter_jobs` — failed jobs for manual investigation

### 3.5 GDPR Compliance Tables

- `audit_logs` — all API access (who/what/when/where/duration)
- `consent_logs` — immutable consent records (terms, marketing, restrictions, objections)
- `data_deletion_requests` — 30-day grace period deletion workflow
- `retention_policies` — configurable per-org data retention

### 3.6 Email Marketing

- `drip_log` — deduplication for drip email campaigns

---

## 4. Backend API (Node + TS + Hono)

### 4.1 Project Structure

```txt
apps/api/
  src/
    index.ts           # Hono app entry
    routes/
      index.ts         # Route aggregation (10 route groups)
      auth.ts          # Authentication, 2FA, OAuth, password reset
      orgs.ts          # Organizations, members, settings, audit logs
      aws-accounts.ts  # AWS accounts CRUD, scan/analyze triggers
      aws-scans.ts     # Scan status and history
      resources.ts     # Resources, dependencies, exports
      findings.ts      # Findings, bulk actions, exports
      gdpr.ts          # GDPR compliance (export, deletion, consent, restriction, objection)
      stripe.ts        # Stripe billing + webhooks
      newsletter.ts    # Newsletter subscribe/unsubscribe
      webhooks.ts      # Email bounce webhook handler
    services/
      auth/            # Auth service module (core, password, verification, OAuth)
      orgService.ts, orgSettingsService.ts
      awsAccountService.ts, resourceService.ts, findingService.ts
      dependencyService.ts, twoFactorService.ts
      emailService.ts, stripeService.ts, consentService.ts
      retentionService.ts, subscriberService.ts
      dripSchedulerService.ts, dripConfig.ts
      subscriberCronService.ts, stuckJobService.ts
    middlewares/
      auth.ts, auditLog.ts, errorHandler.ts
      metrics.ts, processingRestriction.ts, rateLimit.ts
      requestId.ts, requireOrgId.ts, structuredLogger.ts
    lib/
      db.ts, redis.ts, jwt.ts, crypto.ts, config.ts, secrets.ts, errors.ts
    db/
      schema.ts        # 24 Drizzle ORM tables
    types/
      index.ts         # Enums, interfaces, tier limits
```

### 4.2 Key Endpoints

**Authentication (31 endpoints):**
- Multi-step signup: send-code → verify-code → complete-signup
- Login with 2FA challenge flow
- OAuth (Google/GitHub) with consent screen
- Password management, profile updates
- 2FA setup/verify/disable/recovery

**Organizations (10 endpoints):**
- CRUD, members, settings (requiredTags, hiddenFindingTypes, hideTrivial)
- Audit logs (Team-only), subscription status

**AWS Management (12 endpoints):**
- Account CRUD, scanner configuration
- Scan/analyze triggers, scan history and status

**Resources (14 endpoints):**
- List, stats, health, regions, services, export
- Dependencies (graph view), dependents
- Scan history, finding timeline per resource

**Findings (7 endpoints):**
- List, stats, export, bulk update, history

**GDPR (15 endpoints):**
- Data export (Article 20), profile (Article 16)
- Deletion requests with 30-day grace (Article 17)
- Processing restriction (Article 18), objection (Article 21)
- Consent management (Article 7), audit logs

**Billing (5 endpoints):**
- Stripe checkout, plan switch, portal, cancel, webhook

**Newsletter (2 endpoints):**
- Subscribe (public, rate-limited), unsubscribe (HMAC-signed link)

**Webhooks (1 endpoint):**
- Scaleway email bounce handler

**System (4 endpoints):**
- Health (liveness), ready (DB+Redis), metrics (Prometheus), status (authenticated)

---

## 5. Workers (Go)

### 5.1 Scanner Worker (`scanner`)

Responsibilities:

- Poll Redis for `scan_account` jobs.
- For each job:
  1. Fetch `aws_accounts` record (role_arn, external_id, enabled_scanners).
  2. Assume role with AWS STS.
  3. List regions.
  4. For each enabled scanner, scan across all regions:
     - **ec2**: DescribeInstances
     - **ebs**: DescribeVolumes, DescribeSnapshots
     - **rds**: DescribeDBInstances, DescribeDBSnapshots
     - **s3**: ListBuckets + GetBucketLocation/Encryption/PublicAccess (global)
     - **alb**: DescribeLoadBalancers, DescribeTargetGroups
     - **acm**: ListCertificates + DescribeCertificate
     - **lambda**: ListFunctions
     - **cloudwatch**: DescribeLogGroups, DescribeAlarms
     - **iam**: ListUsers, ListRoles, ListPolicies, ListAccessKeys (global)
     - **security_groups**: DescribeSecurityGroups
     - **secrets_manager**: ListSecrets
     - **kms**: ListKeys + DescribeKey
  5. Upsert into `resources` and `certificates` tables.
  6. Track resource deltas via `resource_scans` (new/updated/removed).
  7. Update `scans` status and statistics.

### 5.2 Analyzer Worker (`analyzer`)

7 specialized analyzers, each processing scan results:

| Analyzer | Job Type | Finding Types Generated |
|----------|----------|------------------------|
| **Orphan** | `analyze_orphans` | orphaned_volume, orphaned_eip, orphaned_snapshot, orphaned_eni, idle_load_balancer, unused_security_group, idle_nat_gateway |
| **SSL** | `analyze_ssl` | ssl_expiry (critical if expired/<7d, medium <30d, low <60d) |
| **Residency** | `analyze_residency` | data_residency_violation |
| **Security** | `analyze_security` | unencrypted_resource, public_access, permissive_security_group, open_all_ports |
| **Cost** | `analyze_cost` | unused_resource, stopped_instance, unused_log_group, ebs_optimization, old_gen_instance, oversized_lambda, log_retention, unused_kms_key, rds_optimization, old_gen_rds |
| **Tagging** | `analyze_tagging` | missing_tag |
| **IAM** | `analyze_iam` | user_without_mfa, old_access_key, unused_access_key, unused_iam_role |

Each analyzer:
- Reads resources/certificates from Postgres
- Compares against previous findings for change detection
- Creates new findings or updates detection counts
- Auto-resolves findings when the issue is no longer detected

---

## 6. Frontend

### 6.1 Landing (Astro)

Static marketing site at root domain with pages:
- `/` – Product story, features, screenshots
- `/privacy` – GDPR privacy policy
- `/security` – Security overview (read-only, no SSH, data residency)

### 6.2 Web App (React SPA)

Hosted on `app.` subdomain. Key views:

1. **Onboarding** – AWS account connection with IAM policy + trust policy snippets
2. **Dashboard** – Resource/finding/scan statistics cards
3. **Resources** – Filterable table with dependencies graph (Pro+)
4. **Findings** – Filterable table with bulk actions, severity-based sorting
5. **Infrastructure Map** – Visual dependency graph (Pro+)
6. **Settings** – Org settings, scanner configuration, required tags
7. **Billing** – Subscription management via Stripe portal

---

## 7. Docker Compose Production Setup

### 7.1 Compose Layout

`deploy/docker-compose.yml` defines the production stack.

Services:

- `caddy` – Reverse proxy with automatic TLS (Let's Encrypt), subdomain routing
- `api` – Node.js backend
- `app` – React SPA (static files served by Caddy)
- `landing` – Astro static site (served by Caddy)
- `scanner` – Go scanner worker
- `analyzer` – Go analyzer worker
- `postgres` – PostgreSQL with persistent volume
- `redis` – Redis
- `migrate` – Database migration runner (runs once)
- `umami` – Web analytics
- `prometheus`, `grafana`, `loki`, `promtail`, `alertmanager` – Monitoring stack
- `postgres-exporter`, `redis-exporter` – Database metrics exporters
- `postgres-backup` – Automated daily encrypted backups to Scaleway S3
- `retention-cleanup` – GDPR data retention enforcement
- `watchtower` – Automatic container updates

### 7.2 Hosting

- Scaleway EU (Amsterdam) for GDPR compliance
- Automatic TLS via Caddy + Let's Encrypt
- Docker secrets for production credentials
- Daily encrypted database backups to EU object storage

---

## 8. Implementation Status

### Completed
- Full authentication system (email/password, OAuth, 2FA)
- Multi-step signup with email verification
- Organization management with tier-based access
- AWS account CRUD + STS connection testing
- Scanner worker (11 service types across all regions)
- 7 specialized analyzers
- Resources with dependencies, tags, exports
- Findings with lifecycle, bulk operations, exports
- Stripe billing integration (checkout, portal, webhooks)
- GDPR compliance (export, deletion, consent, restriction, objection, audit logs)
- Rate limiting with circuit breaker
- Newsletter with subscriber service + drip campaigns
- Docker Compose production deployment
- Monitoring stack (Prometheus + Grafana + Loki + Alertmanager)
- 410+ tests with ~53% coverage
