# ScanOrbit Node.js + TypeScript Backend – Implementation Guide

## 1. Architecture Overview

### 1.1 Tech Stack

| Component | Library | Version |
|-----------|---------|---------|
| **Runtime** | Node.js | 25.x |
| **Framework** | Hono.js | 4.x |
| **Database** | PostgreSQL + Drizzle ORM | 17.x, 0.45.x |
| **Type Validation** | Zod | 4.x |
| **Authentication** | jose (JWT) + OAuth + TOTP | 6.x |
| **Password Hashing** | bcrypt | 6.x |
| **2FA** | otpauth (TOTP) | 9.x |
| **Cache/Queue** | Redis (ioredis) | 5.x |
| **AWS SDK** | @aws-sdk/client-sts | 3.x |
| **Billing** | Stripe | 20.x |
| **Email (Transactional)** | Nodemailer + Resend | 8.x, 6.x |
| **Email (Marketing)** | Resend + internal subscriber service | — |
| **Google OAuth** | google-auth-library | 10.x |
| **Metrics** | prom-client | 15.x |
| **Error Handling** | Custom error classes | — |

### 1.2 Project Structure

```
apps/api/
├── src/
│   ├── index.ts                   # Hono app entry point
│   ├── middlewares/
│   │   ├── auth.ts                # JWT verification (requireAuth, optionalAuth)
│   │   ├── auditLog.ts            # GDPR audit logging
│   │   ├── errorHandler.ts        # Global error handling
│   │   ├── metrics.ts             # Prometheus metrics collection
│   │   ├── processingRestriction.ts # GDPR Article 18 write blocking
│   │   ├── rateLimit.ts           # Redis-based rate limiting with circuit breaker
│   │   ├── requestId.ts           # Request ID + trace ID tracking
│   │   ├── requireOrgId.ts        # Org context validation
│   │   └── structuredLogger.ts    # JSON structured logging
│   ├── routes/
│   │   ├── index.ts               # Route aggregation
│   │   ├── auth.ts                # /auth/* (login, signup, 2FA, OAuth)
│   │   ├── orgs.ts                # /orgs/* endpoints
│   │   ├── aws-accounts.ts        # /aws/accounts/* endpoints
│   │   ├── aws-scans.ts           # /aws/scans/* endpoints
│   │   ├── resources.ts           # /resources/* endpoints
│   │   ├── findings.ts            # /findings/* endpoints
│   │   ├── gdpr.ts                # /gdpr/* (data export, deletion, consent)
│   │   ├── stripe.ts              # /stripe/* (billing, webhooks)
│   │   ├── newsletter.ts          # /newsletter/* (subscribe, unsubscribe)
│   │   └── webhooks.ts            # /webhooks/* (email bounce bridge)
│   ├── services/
│   │   ├── auth/                  # Auth service module
│   │   │   ├── index.ts           # Main auth service facade
│   │   │   ├── core.ts            # Core auth logic (signup, login)
│   │   │   ├── password.ts        # Password hashing/verification
│   │   │   ├── verification.ts    # Email verification codes
│   │   │   ├── helpers.ts         # Auth utilities
│   │   │   ├── googleOAuth.ts     # Google OAuth flow
│   │   │   ├── githubOAuth.ts     # GitHub OAuth flow
│   │   │   └── oauthShared.ts     # Shared OAuth utilities
│   │   ├── orgService.ts
│   │   ├── orgSettingsService.ts
│   │   ├── awsAccountService.ts
│   │   ├── resourceService.ts
│   │   ├── findingService.ts
│   │   ├── dependencyService.ts   # Resource dependency tracking
│   │   ├── twoFactorService.ts    # 2FA/TOTP management
│   │   ├── emailService.ts        # Transactional emails (Resend + SMTP)
│   │   ├── stripeService.ts       # Stripe billing
│   │   ├── consentService.ts      # GDPR consent tracking
│   │   ├── retentionService.ts    # Data retention cleanup
│   │   ├── subscriberService.ts   # Subscriber lifecycle management
│   │   ├── subscriberCronService.ts # Periodic subscriber sync
│   │   ├── dripSchedulerService.ts # Drip email campaign scheduling
│   │   ├── dripConfig.ts          # Email sequence configuration
│   │   └── stuckJobService.ts     # Dead letter queue handling
│   ├── db/
│   │   ├── schema.ts              # Drizzle schema definitions
│   │   ├── migrate.ts             # Migration runner
│   │   └── reset.ts               # Database reset utility
│   ├── lib/
│   │   ├── db.ts                  # Drizzle client setup
│   │   ├── redis.ts               # ioredis client
│   │   ├── jwt.ts                 # jose JWT helpers
│   │   ├── crypto.ts              # AES-256-GCM encryption utilities
│   │   ├── config.ts              # Environment config
│   │   ├── secrets.ts             # Docker secrets reader
│   │   └── errors.ts              # Error classes
│   ├── types/
│   │   └── index.ts               # Shared types, enums, tier limits
│   └── test/
│       └── setup.ts               # Vitest test setup
├── drizzle/                       # Generated migrations
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── drizzle.config.cjs
└── Dockerfile
```

**Note:** The codebase uses a flat structure without controllers or repositories. Routes call services directly, and services use Drizzle ORM for database access. Services are ES module singletons (no DI).

---

## 2. Database Schema (Drizzle ORM)

The schema is defined in `apps/api/src/db/schema.ts`. Below is a summary of all 17 tables.

### 2.1 Core Tables

#### `users`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK, auto-generated |
| email | varchar(255) | Unique, not null |
| passwordHash | varchar(255) | Nullable (OAuth-only users) |
| fullName | varchar(255) | |
| emailVerified | boolean | Default false |
| emailVerificationCode | varchar(6) | |
| emailVerificationExpiresAt | timestamp | |
| twoFactorEnabled | boolean | Default false |
| twoFactorSecret | text | Encrypted at rest (AES-256-GCM) |
| twoFactorRecoveryCodes | text | Encrypted at rest |
| processingRestricted | boolean | Default false (GDPR Article 18) |
| processingRestrictedAt | timestamp | |
| createdAt | timestamp | |
| updatedAt | timestamp | |

#### `userOauthAccounts`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| userId | uuid | FK → users |
| provider | varchar(50) | 'google' or 'github' |
| providerUserId | varchar(255) | Provider's user ID |
| providerEmail | varchar(255) | |
| accessToken | text | Encrypted at rest |
| refreshToken | text | Encrypted at rest |
| tokenExpiresAt | timestamp | |
| rawProfile | jsonb | |
| createdAt, updatedAt | timestamp | |

#### `orgs`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| name | varchar(255) | |
| slug | varchar(255) | Unique |
| logoUrl | varchar(255) | |
| tier | varchar(50) | 'free', 'pro', 'team' (default: free) |
| tierUpgradedAt | timestamp | |
| stripeCustomerId | varchar(255) | |
| stripeSubscriptionId | varchar(255) | |
| subscriptionStatus | varchar(50) | 'none', 'trialing', 'active', 'canceled', 'past_due', 'unpaid' |
| trialEndsAt | timestamp | |
| subscriptionEndsAt | timestamp | |
| createdAt, updatedAt | timestamp | |

#### `userOrgMembers`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| userId | uuid | FK → users |
| orgId | uuid | FK → orgs |
| role | varchar(50) | 'admin' or 'member' |
| title | varchar(50) | 'devops', 'cto', 'developer', 'security', 'personal', 'other' |
| createdAt | timestamp | |
| | | Unique: (userId, orgId) |

#### `orgSettings`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| orgId | uuid | FK → orgs |
| requiredTags | text[] | Tag names to enforce |
| hiddenFindingTypes | text[] | Finding types hidden from UI |
| hideTrivial | boolean | Default false |
| createdAt, updatedAt | timestamp | |

### 2.2 AWS Infrastructure Tables

#### `awsAccounts`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| orgId | uuid | FK → orgs |
| name | varchar(255) | |
| awsAccountId | varchar(12) | 12-digit AWS account ID |
| roleArn | varchar(255) | IAM role ARN |
| externalId | varchar(255) | STS external ID |
| status | varchar(50) | 'pending', 'ok', 'error' |
| lastError | text | |
| lastScanAt | timestamp | |
| enabledScanners | jsonb | Array of scanner types (default: all 11) |
| createdAt, updatedAt | timestamp | |
| | | Unique: (orgId, awsAccountId) |

**Scanner types:** ec2, rds, s3, alb, acm, lambda, cloudwatch, iam, security_groups, secrets_manager, kms

#### `scans`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| orgId | uuid | FK → orgs |
| awsAccountId | uuid | FK → awsAccounts |
| status | varchar(50) | queued, processing, running, analyzing, complete, partial, error, canceled |
| hasKey | boolean | |
| startedAt, completedAt | timestamp | |
| resourcesDiscovered | integer | |
| resourcesDelta | integer | |
| findingsNew, findingsResolved | integer | |
| errorMessage | text | |
| createdAt | timestamp | |

#### `resources`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| orgId | uuid | FK → orgs |
| awsAccountId | uuid | FK → awsAccounts |
| resourceId | varchar(255) | AWS ARN |
| service | varchar(50) | ec2, ebs, rds, s3, alb, acm, eip, snapshot, lambda, etc. |
| region | varchar(50) | |
| name | varchar(255) | |
| state | varchar(50) | |
| tags | jsonb | Default {} |
| costEstimateMonthly | numeric(10,2) | |
| lastSeenAt | timestamp | |
| raw | jsonb | Full AWS API response |
| createdAt, updatedAt | timestamp | |
| | | Unique: (orgId, awsAccountId, resourceId) |

#### `resourceDependencies`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| orgId | uuid | FK → orgs |
| sourceResourceId | uuid | FK → resources |
| targetResourceId | varchar(255) | ARN of target |
| targetService | varchar(50) | |
| relationshipType | varchar(50) | uses_role, in_vpc, in_subnet, uses_sg, attached_to, targets, owns, uses_layer, encrypted_by |
| createdAt | timestamp | |
| | | Unique: (orgId, sourceResourceId, targetResourceId, relationshipType) |

#### `resourceScans`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| resourceId | uuid | FK → resources |
| scanId | uuid | FK → scans |
| status | varchar(50) | 'new', 'updated', 'removed' |
| createdAt | timestamp | |
| | | Unique: (resourceId, scanId) |

#### `certificates`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| orgId | uuid | FK → orgs |
| awsAccountId | uuid | FK → awsAccounts |
| identifier | varchar(255) | ARN or fingerprint |
| source | varchar(50) | 'acm' or 'endpoint_scan' |
| primaryDomain | varchar(255) | |
| altNames | text[] | |
| notBefore, notAfter | timestamp | |
| issuer | varchar(255) | |
| algorithm | varchar(50) | |
| lastSeenAt | timestamp | |
| createdAt, updatedAt | timestamp | |
| | | Unique: (orgId, awsAccountId, identifier) |

### 2.3 Findings Tables

#### `findings`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| orgId | uuid | FK → orgs |
| awsAccountId | uuid | FK → awsAccounts |
| resourceId | uuid | FK → resources (nullable, set null on delete) |
| certificateId | uuid | FK → certificates (nullable) |
| type | varchar(50) | See FINDINGS.md for all types |
| severity | varchar(50) | critical, high, medium, low, trivial |
| summary | text | |
| details | jsonb | Default {} |
| status | varchar(50) | open, resolved, snoozed, ignored |
| resolvedAt | timestamp | |
| snoozedUntil | timestamp | |
| firstDetectedAt | timestamp | |
| lastDetectedAt | timestamp | |
| detectionCount | integer | Default 1 |
| lastScanId | uuid | FK → scans |
| createdAt, updatedAt | timestamp | |

#### `findingScans`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| findingId | uuid | FK → findings |
| scanId | uuid | FK → scans |
| status | varchar(50) | 'detected' or 'not_detected' |
| createdAt | timestamp | |

### 2.4 Background Jobs

#### `jobs`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| scanId | uuid | FK → scans |
| type | varchar(50) | scan_account, analyze_orphans, analyze_ssl, analyze_residency, analyze_security, analyze_cost, analyze_tagging, analyze_iam |
| payload | jsonb | |
| status | varchar(50) | queued, running, complete, error |
| result | jsonb | |
| error | text | |
| recoveryCount | integer | Default 0 |
| createdAt, startedAt, completedAt | timestamp | |

#### `deadLetterJobs`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| jobId | uuid | |
| jobType | varchar(50) | |
| payload | jsonb | |
| error | text | |
| retries | integer | |
| createdAt | timestamp | |

### 2.5 GDPR Compliance Tables

#### `auditLogs`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| userId | uuid | FK → users |
| action | varchar(50) | login, logout, read, create, update, delete, export |
| method | varchar(10) | HTTP method |
| path | varchar(500) | |
| statusCode | integer | |
| ipAddress | varchar(50) | |
| userAgent | text | |
| durationMs | integer | |
| timestamp | timestamp | |

#### `consentLogs`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK (immutable records) |
| userId | uuid | FK → users |
| email | varchar(255) | |
| consentType | varchar(50) | terms_and_privacy, marketing, processing_restriction, objection |
| consentGiven | boolean | |
| consentVersion | varchar(50) | |
| ipAddress, userAgent | text | |
| metadata | jsonb | |
| consentedAt | timestamp | |

#### `dataDeletionRequests`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| userId | uuid | FK → users |
| email | varchar(255) | |
| requestType | varchar(50) | full_deletion, anonymization, data_export |
| status | varchar(50) | pending, processing, completed, cancelled |
| reason | text | |
| scheduledDeletionAt | timestamp | 30-day grace period |
| processedAt | timestamp | |
| ipAddress, userAgent | text | |
| notes | text | |
| processedBy | varchar(255) | |
| requestedAt | timestamp | |

#### `retentionPolicies`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| orgId | uuid | FK → orgs |
| dataType | varchar(50) | resources, findings, scans, audit_logs |
| retentionDays | integer | |
| createdAt, updatedAt | timestamp | |

### 2.6 Email Marketing

#### `dripLog`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| subscriberEmail | varchar(255) | |
| sequenceName | varchar(50) | |
| emailDay | integer | |
| sentAt | timestamp | |
| | | Deduplication: prevents sending same drip email twice |

### 2.7 Migrations

Migrations are managed with Drizzle Kit:

```bash
pnpm --filter @scanorbit/api db:generate   # Generate migrations from schema changes
pnpm --filter @scanorbit/api db:migrate     # Apply migrations (via tsx runner)
pnpm --filter @scanorbit/api db:migrate:kit # Apply migrations (via drizzle-kit)
pnpm --filter @scanorbit/api db:studio      # Open Drizzle Studio for database browsing
```

---

## 3. Authentication

### 3.1 JWT Strategy

- **Access tokens**: 5 min expiry, stored in frontend memory, sent via `Authorization: Bearer <token>`
- **Refresh tokens**: 7 day expiry, stored in httpOnly secure cookies, revocable via Redis
- **Library**: `jose` for JWT signing/verification with HS256

```typescript
// Access token: contains userId + orgId context
const accessToken = await signAccessToken({ userId: user.id, orgId: orgs[0]?.id ?? null });

// Refresh token: contains userId + tokenId (for revocation)
const { token: refreshToken, tokenId } = await signRefreshToken(user.id);
await refreshTokenStore.store(tokenId, user.id);
```

### 3.2 Signup Flow (New)

The current signup is a multi-step process:

1. `POST /auth/send-code` — Send 6-digit verification code to email
2. `POST /auth/verify-code` — Verify code, receive a `signupToken`
3. `POST /auth/complete-signup` — Submit password + consent, create user account
4. `POST /orgs` — Create organization (separate step after signup)

### 3.3 Login Flow

```
POST /auth/login (email + password)
  ├─ If 2FA disabled → return { user, orgs, accessToken } + set refresh cookie
  └─ If 2FA enabled → return { challengeToken, requires2FA: true }
       ├─ POST /auth/2fa/verify (challengeToken + TOTP code)
       └─ POST /auth/2fa/verify-recovery (challengeToken + recoveryCode)
           └─ return { user, orgs, accessToken } + set refresh cookie
```

### 3.4 OAuth Flow (Google / GitHub)

1. Frontend redirects to `GET /auth/google` or `GET /auth/github`
2. User authenticates with provider
3. Provider redirects to callback URL
4. If new user → return `{ requiresConsent: true, consentToken }` → frontend shows consent form
5. `POST /auth/oauth/complete-signup` — Accept terms, optionally opt into newsletter
6. If existing user with 2FA → return `{ requires2FA: true, challengeToken }`
7. Otherwise → issue tokens and redirect to dashboard

OAuth accounts are stored in the separate `userOauthAccounts` table, not directly on the `users` table.

---

## 4. Middleware Stack

Applied globally in this order:

| Order | Middleware | Purpose |
|-------|-----------|---------|
| 1 | `bodyLimit(1MB)` | Prevent large payload DoS |
| 2 | `secureHeaders` | HSTS, X-Frame-Options, CSP, XSS, MIME sniffing |
| 3 | `cors` | Origin: config.frontendUrl, credentials: true |
| 4 | `requestIdMiddleware` | Generate/propagate x-request-id and x-trace-id |
| 5 | `structuredLoggerMiddleware` | JSON structured logging (Loki/Promtail compatible) |
| 6 | `metricsMiddleware` | Prometheus request count + duration metrics |
| 7 | `auditLog` | GDPR audit logging (fire-and-forget, non-blocking) |

Route-level middleware:
- `requireAuth` — JWT verification, sets userId + orgId in context
- `optionalAuth` — Same but doesn't fail without token
- `requireOrgId` — Validates orgId is set in context (400 if missing)
- `requireNoProcessingRestriction` — Blocks POST/PUT/PATCH/DELETE when GDPR Article 18 restriction active
- `rateLimit(type)` — Redis-based rate limiting per endpoint category

---

## 5. App Entry Point (src/index.ts)

```typescript
const app = new Hono();

// Global middleware
app.use(bodyLimit({ maxSize: 1024 * 1024 }));  // 1MB
app.use(secureHeaders());
app.use(cors({ origin: config.frontendUrl, credentials: true }));
app.use(requestIdMiddleware);
app.use(structuredLoggerMiddleware);
app.use(metricsMiddleware);
app.use(auditLog);

// Health & system endpoints
app.get('/health', ...);        // Liveness (always 200)
app.get('/health/ready', ...);  // Readiness (checks DB + Redis)
app.get('/metrics', ...);       // Prometheus metrics
app.get('/status', ...);        // Authenticated system status

// API routes (10 route groups)
app.route('/auth', authRoute);
app.route('/orgs', orgsRoute);
app.route('/aws/accounts', awsAccountsRoute);
app.route('/aws/scans', awsScansRoute);
app.route('/resources', resourcesRoute);
app.route('/findings', findingsRoute);
app.route('/gdpr', gdprRoute);
app.route('/stripe', stripeRoute);
app.route('/newsletter', newsletterRoute);
app.route('/webhooks', webhooksRoute);

// Error handler + 404 handler
app.onError(errorHandler);
app.notFound(...);
```

Server starts with graceful shutdown handler (SIGTERM/SIGINT, 30s timeout). After startup, initializes subscriber sync and drip scheduler.

---

## 6. API Endpoints

### 6.1 Authentication (`/auth`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/send-code` | — | Send verification code (new signup step 1) |
| POST | `/auth/verify-code` | — | Verify code, get signup token (step 2) |
| POST | `/auth/complete-signup` | — | Complete signup with password + consent (step 3) |
| POST | `/auth/resend-code` | — | Resend signup verification code |
| POST | `/auth/signup` | — | Legacy email/password signup |
| POST | `/auth/verify-email` | — | Legacy email verification |
| POST | `/auth/resend-verification` | — | Legacy resend verification |
| POST | `/auth/login` | — | Login (returns challengeToken if 2FA) |
| POST | `/auth/logout` | — | Revoke refresh token, clear cookies |
| GET | `/auth/logout` | — | Browser logout redirect |
| POST | `/auth/refresh` | — | Get new access token via refresh cookie |
| GET | `/auth/me` | ✅ | Current user profile + org memberships |
| POST | `/auth/switch-org` | ✅ | Switch active organization |
| POST | `/auth/forgot-password` | — | Request password reset email |
| POST | `/auth/reset-password` | — | Reset password with token |
| POST | `/auth/change-password` | ✅ | Change password (requires current) |
| POST | `/auth/set-password` | ✅ | Set password for OAuth-only users |
| PATCH | `/auth/profile` | ✅ | Update fullName |
| GET | `/auth/2fa/status` | ✅ | Check 2FA status |
| POST | `/auth/2fa/setup/init` | ✅ | Start 2FA setup, get QR secret |
| POST | `/auth/2fa/setup/verify` | ✅ | Verify TOTP and enable 2FA |
| POST | `/auth/2fa/disable` | ✅ | Disable 2FA (password + TOTP) |
| POST | `/auth/2fa/verify` | — | Verify TOTP during login challenge |
| POST | `/auth/2fa/verify-recovery` | — | Use recovery code during login |
| POST | `/auth/2fa/recovery-codes/regenerate` | ✅ | Regenerate recovery codes |
| GET | `/auth/google` | — | Initiate Google OAuth |
| GET | `/auth/google/callback` | — | Google OAuth callback |
| POST | `/auth/google/token` | — | Exchange Google ID token |
| GET | `/auth/github` | — | Initiate GitHub OAuth |
| GET | `/auth/github/callback` | — | GitHub OAuth callback |
| POST | `/auth/oauth/complete-signup` | — | Complete OAuth signup after consent |

### 6.2 Organizations (`/orgs`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/orgs` | ✅ | Create organization |
| GET | `/orgs` | ✅ | List user's organizations |
| GET | `/orgs/:id` | ✅ | Get org details |
| PATCH | `/orgs/:id` | ✅ | Update org (name, logoUrl) |
| GET | `/orgs/:id/members` | ✅ | Get org members |
| GET | `/orgs/:id/settings` | ✅ | Get viewing settings |
| PATCH | `/orgs/:id/settings` | ✅ | Update viewing settings |
| GET | `/orgs/:id/audit-logs` | ✅ | Audit logs (Team-only) |
| GET | `/orgs/:id/subscription` | ✅ | Get subscription status |
| POST | `/orgs/:id/subscription/upgrade` | ✅ | Upgrade subscription tier |

### 6.3 AWS Accounts (`/aws/accounts`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/aws/accounts` | ✅ | List AWS accounts |
| POST | `/aws/accounts` | ✅ | Create AWS account |
| GET | `/aws/accounts/:id` | ✅ | Get account details |
| DELETE | `/aws/accounts/:id` | ✅ | Delete account |
| PATCH | `/aws/accounts/:id/scanners` | ✅ | Update enabled scanners |
| POST | `/aws/accounts/:id/test` | ✅ | Test connection (STS AssumeRole) |
| POST | `/aws/accounts/:id/scan` | ✅ | Enqueue scan (returns 202) |
| GET | `/aws/accounts/:id/scans` | ✅ | Scan history |
| POST | `/aws/accounts/:id/analyze` | ✅ | Trigger analysis |

### 6.4 Scans (`/aws/scans`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/aws/scans/active` | ✅ | Active scans (pending/running) |
| GET | `/aws/scans/recent` | ✅ | Recent scans |
| GET | `/aws/scans/:scanId` | ✅ | Scan details |

### 6.5 Resources (`/resources`)

| Method | Path | Auth | Tier | Description |
|--------|------|------|------|-------------|
| GET | `/resources` | ✅ | Pro+ | List resources with filters |
| GET | `/resources/stats` | ✅ | All | Resource statistics |
| GET | `/resources/health` | ✅ | All | Resource health from findings |
| GET | `/resources/regions` | ✅ | All | Distinct regions |
| GET | `/resources/services` | ✅ | All | Distinct services |
| GET | `/resources/export` | ✅ | Team | CSV/JSON export (max 10k rows) |
| GET | `/resources/dependencies/all` | ✅ | Pro+ | All dependencies (graph) |
| GET | `/resources/dependencies/stats` | ✅ | Pro+ | Dependency statistics |
| GET | `/resources/:id` | ✅ | All | Resource details |
| PATCH | `/resources/:id` | ✅ | All | Update tags (max 50) |
| GET | `/resources/:id/dependencies` | ✅ | Pro+ | Outgoing relationships |
| GET | `/resources/:id/dependents` | ✅ | Pro+ | Incoming relationships |
| GET | `/resources/:id/scan-history` | ✅ | All | Scan history (last 50) |
| GET | `/resources/:id/finding-timeline` | ✅ | All | Finding detection timeline |

### 6.6 Findings (`/findings`)

| Method | Path | Auth | Tier | Description |
|--------|------|------|------|-------------|
| GET | `/findings` | ✅ | Pro+ | List findings with filters |
| GET | `/findings/stats` | ✅ | All | Finding statistics |
| GET | `/findings/export` | ✅ | Team | CSV/JSON export (max 10k rows) |
| POST | `/findings/bulk-update` | ✅ | Pro+ | Bulk status update (max 100) |
| GET | `/findings/:id` | ✅ | All | Finding details |
| PATCH | `/findings/:id` | ✅ | All | Update status |
| GET | `/findings/:id/history` | ✅ | All | Detection history |

### 6.7 GDPR (`/gdpr`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/gdpr/export` | ✅ | Export all personal data (Article 20) |
| GET | `/gdpr/profile` | ✅ | Get personal profile data |
| PATCH | `/gdpr/profile` | ✅ | Update personal data (Article 16) |
| GET | `/gdpr/audit-logs` | ✅ | View own audit logs |
| POST | `/gdpr/delete` | ✅ | Request account deletion (Article 17) |
| DELETE | `/gdpr/delete/:requestId` | ✅ | Cancel deletion request |
| GET | `/gdpr/deletion-status` | ✅ | Check deletion request status |
| GET | `/gdpr/consent/marketing` | ✅ | Get marketing consent status |
| PUT | `/gdpr/consent/marketing` | ✅ | Update marketing consent (Article 7) |
| GET | `/gdpr/consent/history` | ✅ | Complete consent history |
| GET | `/gdpr/restriction` | ✅ | Get processing restriction status (Article 18) |
| PUT | `/gdpr/restriction` | ✅ | Toggle processing restriction |
| GET | `/gdpr/objection` | ✅ | Get objection status (Article 21) |
| POST | `/gdpr/objection` | ✅ | Object to processing activity |
| DELETE | `/gdpr/objection` | ✅ | Withdraw objection |

### 6.8 Stripe Billing (`/stripe`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/stripe/checkout` | ✅ | Create Checkout session (pro/team) |
| POST | `/stripe/switch-plan` | ✅ | Switch subscription plan |
| POST | `/stripe/portal` | ✅ | Customer Portal session |
| POST | `/stripe/cancel` | ✅ | Cancel subscription |
| POST | `/stripe/webhook` | — | Stripe webhook handler (signature verified) |

Webhook events handled: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.trial_will_end`, `invoice.payment_failed`

### 6.9 Newsletter (`/newsletter`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/newsletter/subscribe` | — | Subscribe (public, rate-limited) |
| GET | `/newsletter/unsubscribe` | — | Unsubscribe via HMAC link |

### 6.10 Webhooks (`/webhooks`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/webhooks/scaleway-bounce` | Secret | Handle Scaleway email bounces |

### 6.11 System

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | — | Liveness probe (always 200) |
| GET | `/health/ready` | — | Readiness probe (DB + Redis check) |
| GET | `/metrics` | — | Prometheus metrics |
| GET | `/status` | ✅ | System status (queues, memory, uptime) |

---

## 7. Rate Limiting

Redis-based sliding window with circuit breaker fallback:

| Category | Limit | Per | Fail Mode |
|----------|-------|-----|-----------|
| Login (by IP) | 5/15min | IP | Strict |
| Login (by email) | 5/15min | email | Strict |
| Send code (by IP) | 3/5min | IP | Strict |
| Send code (by email) | 3/5min | email | Strict |
| Verify code (by IP) | 10/15min | IP | Strict |
| Verify code (by email) | 5/15min | email | Strict |
| Password reset | 3/1hr | IP | Strict |
| Newsletter | 3/10min | IP | Fail-open |
| General API | 100/min | IP | Fail-open (JWT) |

**Dual limiting**: Login, signup, and code verification have both IP-based and email-based limits (stricter of the two applies).

---

## 8. Email Services

### 8.1 Transactional Email (emailService.ts)

Supports two providers, configured via `EMAIL_PROVIDER`:
- **Resend** — HTTP API (`resend` package)
- **SMTP** — Nodemailer

Sends: verification codes, password reset links, trial ending notifications, payment failed alerts.

### 8.2 Subscriber Lifecycle (subscriberService.ts)

Internal subscriber management (replaces Listmonk):
- User segment lists: cold leads, subscribers, free (new/scanned), trial (new/active), paid (pro/team)
- Lifecycle hooks: `onUserSignup`, `onTrialStart`, `onPayment`, `onChurn`, `onPlanChange`
- Stored in `email_subscribers` table with attributes

### 8.3 Drip Campaigns (dripSchedulerService.ts)

Automated email sequences via Resend:
- 25+ drip templates across 7 sequences (cold, subscriber, free_new, free_scanned, trial_new, trial_active, paid)
- Deduplication via `dripLog` table
- Runs on configurable schedule after server startup

---

## 9. Tier-Based Access Control

| Feature | Free | Pro | Team |
|---------|------|-----|------|
| Resource list view | — | ✅ | ✅ |
| Finding list view | — | ✅ | ✅ |
| Infrastructure map | — | ✅ | ✅ |
| Audit logs | — | — | ✅ |
| Data export (CSV/JSON) | — | — | ✅ |
| Scan cooldown | One scan ever | 60 min | None |
| Max AWS accounts | 1 | 1 | Unlimited |
| Resource/finding health | ✅ | ✅ | ✅ |
| Org overview | — | — | ✅ |
| Invite members | — | — | ✅ |

---

## 10. Development & Deployment

### 10.1 Development Setup

```bash
pnpm install                                    # Install dependencies (monorepo root)
pnpm --filter @scanorbit/api dev               # Dev server with hot reload (tsx)
pnpm --filter @scanorbit/api db:generate       # Generate migrations
pnpm --filter @scanorbit/api db:migrate        # Apply migrations
pnpm --filter @scanorbit/api db:studio         # Browse database
pnpm --filter @scanorbit/api test              # Run tests (vitest)
pnpm --filter @scanorbit/api test:coverage     # Run with coverage
```

### 10.2 Testing

- **Framework**: Vitest with `@vitest/coverage-v8`
- **Tests**: 410+ tests across 35 files, ~53% statement coverage
- **Pattern**: `vi.mock()` with `vi.hoisted()` for module-level mocking
- **DB Mocking**: `createChain()` helper for Drizzle ORM chain mocking

### 10.3 Dockerfile

Multi-stage build:
- **Builder**: `node:25-alpine` + pnpm, builds TypeScript
- **Production**: `node:25-alpine` + pnpm (prod deps only), runs as non-root user `nodejs:1001`
- Built-in health check: `wget --spider http://127.0.0.1:4000/health`

### 10.4 Environment Variables

See `apps/api/src/lib/config.ts` for all configuration. Key groups:

| Group | Variables |
|-------|-----------|
| **Server** | PORT, NODE_ENV |
| **Database** | DATABASE_URL (secret) |
| **Cache** | REDIS_URL (secret) |
| **JWT** | JWT_SECRET, JWT_REFRESH_SECRET, ACCESS_TOKEN_EXPIRY_MINUTES |
| **Encryption** | TOTP_ENCRYPTION_KEY, OAUTH_ENCRYPTION_KEY (64 hex chars each) |
| **OAuth** | GOOGLE_CLIENT_ID/SECRET/CALLBACK_URL, GITHUB_CLIENT_ID/SECRET/CALLBACK_URL |
| **AWS** | AWS_REGION |
| **Frontend** | FRONTEND_URL, COOKIE_DOMAIN |
| **Email** | EMAIL_PROVIDER, EMAIL_FROM, RESEND_API_KEY, SMTP_* |
| **Stripe** | STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRO/TEAM_PRICE_ID, STRIPE_TRIAL_DAYS |
| **Webhooks** | SCALEWAY_WEBHOOK_SECRET, NEWSLETTER_UNSUBSCRIBE_SECRET |
| **GDPR Retention** | RETENTION_RESOURCES_DAYS (90), RETENTION_FINDINGS_RESOLVED_DAYS (180), RETENTION_SCANS_DAYS (365), RETENTION_AUDIT_LOGS_DAYS (730) |
| **Security** | TRUSTED_PROXIES, LOG_LEVEL |

Secrets in production are read from Docker secrets (`/run/secrets/`) with environment variable fallback.

---

## 11. Key Considerations

1. **Connection Pooling**: postgres.js handles concurrent connections (configurable in `lib/db.ts`)
2. **Drizzle ORM**: Type-safe queries with schema inference (`$inferSelect`, `$inferInsert`)
3. **Error Handling**: Custom error classes (`HTTP400Error`, `HTTP401Error`, `HTTP403Error`, `HTTP404Error`, `HTTP409Error`, `HTTP429Error`) with automatic status codes
4. **JWT Strategy**: `jose` for JWT; access tokens (5 min) via Bearer header, refresh tokens (7 days) via httpOnly cookie
5. **JSONB for Flexibility**: tags, details, raw provider data, enabledScanners stored as JSONB columns
6. **Indexes**: Composite unique indexes on common query patterns
7. **Migrations**: Managed by Drizzle Kit with custom tsx-based runner
8. **ESM**: Project uses ES modules (`"type": "module"`)
9. **Graceful Shutdown**: SIGTERM/SIGINT handlers with 30s timeout, cleans up DB + Redis connections
10. **GDPR**: Full Article compliance — audit logging, consent tracking, data export, deletion requests with 30-day grace period, processing restriction, objection handling
11. **CSV Export Safety**: Formula injection protection (sanitizes cells starting with =, +, -, @, \t), hard cap at 10,000 rows
