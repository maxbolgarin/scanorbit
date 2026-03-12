# Remaining Team Plan Features — Implementation Spec

## Status

Phases 1-3 are complete (maxAccounts enforcement, scan priority, tier-based retention, data export, audit logs). Two features remain:

- **Phase 4**: Team Members & Invites
- **Phase 5**: Webhook Notifications

---

## Phase 4: Team Members & Invites

### Overview

Allow Team-tier organizations to invite people by email. Invitees receive a token-based link, and upon accepting they join the org as `member` (read-only) or `admin` (full access). The existing `userOrgMembers` table already tracks membership with role support — only the invitation flow is missing.

### What Exists

| Component | File | Status |
|---|---|---|
| `userOrgMembers` table (id, userId, orgId, role, title) | `apps/api/src/db/schema.ts:88-110` | Ready |
| `OrgMember` frontend type (id, userId, role, createdAt, user?) | `apps/app/src/types/index.ts:125-132` | Ready |
| `orgService.getOrgMembers()` — returns members with user info | `apps/api/src/services/orgService.ts:229-261` | Ready |
| `orgService.verifyOrgAdmin()` — throws 403 if not admin | `apps/api/src/services/orgService.ts:65-84` | Ready |
| `GET /orgs/:id/members` — list members endpoint | `apps/api/src/routes/orgs.ts:85-91` | Ready |
| `api.getOrgMembers()` — frontend API call | `apps/app/src/lib/api.ts:486-493` | Ready |
| `canInviteMembers` tier flag (Team-only) | `apps/api/src/types/index.ts`, `apps/app/src/types/index.ts` | Ready |
| Email service (Resend + SMTP providers) | `apps/api/src/services/emailService.ts` | Ready |

### What Needs to Be Built

#### 4.1 Database: `orgInvitations` table

Add to `apps/api/src/db/schema.ts`:

```
orgInvitations
├── id              uuid PK
├── orgId           uuid FK → orgs.id (cascade delete)
├── email           varchar(255) NOT NULL
├── role            varchar(50) default 'member'  ('admin' | 'member')
├── invitedBy       uuid FK → users.id (set null on delete)
├── token           varchar(255) UNIQUE NOT NULL   (crypto.randomUUID or nanoid)
├── status          varchar(50) default 'pending'  ('pending' | 'accepted' | 'canceled' | 'expired')
├── expiresAt       timestamp NOT NULL             (7 days from creation)
└── createdAt       timestamp default now()
```

Indexes: unique on (orgId, email) where status = 'pending' (prevent duplicate pending invites), index on token (for lookup).

Run migration: `pnpm drizzle-kit generate` then `pnpm drizzle-kit migrate`.

#### 4.2 Backend: `invitationService.ts`

New file: `apps/api/src/services/invitationService.ts`

Methods:

```typescript
// Create invitation — admin-only, Team-only
createInvitation(orgId: string, adminUserId: string, email: string, role: 'admin' | 'member'): Promise<Invitation>
  - Verify admin via orgService.verifyOrgAdmin()
  - Check TIER_LIMITS[tier].canInviteMembers
  - Check max members limit (e.g., 20 for Team)
  - Check email isn't already a member
  - Check no pending invitation for this email
  - Generate token (crypto.randomUUID())
  - Insert into orgInvitations
  - Send invitation email via emailService
  - Return invitation record

// Accept invitation — called by the invitee
acceptInvitation(token: string, userId: string): Promise<{ org: Org }>
  - Find invitation by token, verify status = 'pending' and not expired
  - Check user isn't already in the org
  - Insert into userOrgMembers with invitation's role
  - Update invitation status to 'accepted'
  - Return org data for auth token refresh

// Cancel invitation — admin-only
cancelInvitation(orgId: string, adminUserId: string, invitationId: string): Promise<void>
  - Verify admin
  - Update invitation status to 'canceled'

// List pending invitations — admin-only
listInvitations(orgId: string, adminUserId: string): Promise<Invitation[]>
  - Return pending invitations for the org

// Resend invitation — admin-only
resendInvitation(orgId: string, adminUserId: string, invitationId: string): Promise<void>
  - Verify invitation is still pending and not expired
  - Resend email, optionally extend expiresAt

// Remove member — admin-only, cannot remove self if last admin
removeMember(orgId: string, adminUserId: string, memberUserId: string): Promise<void>
  - Verify admin
  - Prevent removing the last admin
  - Delete from userOrgMembers

// Change member role — admin-only
changeMemberRole(orgId: string, adminUserId: string, memberUserId: string, role: 'admin' | 'member'): Promise<void>
  - Verify admin
  - Prevent demoting the last admin
  - Update role in userOrgMembers
```

#### 4.3 Backend: Invitation Email

Add to `apps/api/src/services/emailService.ts`:

```typescript
sendInvitationEmail(email: string, inviterName: string, orgName: string, token: string): Promise<void>
```

Template: branded HTML email with "Join {orgName}" CTA button linking to `{frontendUrl}/invite/{token}`.

#### 4.4 Backend: API Routes

Add to `apps/api/src/routes/orgs.ts` (under audit logs section):

```
POST   /orgs/:id/invitations           — Create invitation (admin, Team-only)
GET    /orgs/:id/invitations           — List pending invitations (admin)
DELETE /orgs/:id/invitations/:invId    — Cancel invitation (admin)
POST   /orgs/:id/invitations/:invId/resend — Resend invitation email (admin)
DELETE /orgs/:id/members/:userId       — Remove member (admin)
PATCH  /orgs/:id/members/:userId       — Change member role (admin)
```

Separate public route (no org context needed):
```
POST   /auth/accept-invite             — Accept invitation { token }
```

This goes in `apps/api/src/routes/auth.ts` since it's an auth-adjacent action (user must be logged in but doesn't need orgId in JWT yet).

Validation schemas:
```typescript
const createInvitationSchema = z.object({
  email: z.string().email().max(255),
  role: z.enum(['admin', 'member']).default('member'),
});

const acceptInviteSchema = z.object({
  token: z.string().uuid(),
});

const changeMemberRoleSchema = z.object({
  role: z.enum(['admin', 'member']),
});
```

#### 4.5 Frontend: Invite Accept Page

New route: `/invite/:token` → new page `apps/app/src/pages/AcceptInvite.tsx`

Flow:
1. User lands on `/invite/{token}`
2. If not logged in → redirect to `/login?redirect=/invite/{token}`
3. If logged in → call `POST /auth/accept-invite` with token
4. On success → refresh auth store, redirect to dashboard of the new org
5. On error → show error (expired, already member, invalid token)

#### 4.6 Frontend: Team Members Settings Tab

New component: `apps/app/src/components/settings/TeamSettings.tsx`

Add as new tab in `apps/app/src/pages/Settings.tsx` (conditionally shown for Team tier, similar to Audit Log tab).

UI sections:
1. **Current Members** — table with columns: Name, Email, Role (badge), Joined date, Actions (change role dropdown, remove button). Admin-only actions.
2. **Pending Invitations** — table with: Email, Role, Invited by, Sent date, Actions (resend, cancel). Admin-only.
3. **Invite Form** — email input + role select + "Send Invite" button. Only visible to admins.

Hooks needed in `apps/app/src/hooks/use-members.ts`:
```typescript
useOrgMembers(orgId)        — GET /orgs/:id/members
useOrgInvitations(orgId)    — GET /orgs/:id/invitations
useInviteMember()           — POST /orgs/:id/invitations
useCancelInvitation()       — DELETE /orgs/:id/invitations/:id
useResendInvitation()       — POST /orgs/:id/invitations/:id/resend
useRemoveMember()           — DELETE /orgs/:id/members/:userId
useChangeMemberRole()       — PATCH /orgs/:id/members/:userId
```

API functions in `apps/app/src/lib/api.ts`:
```typescript
getOrgInvitations(orgId): Promise<Invitation[]>
createInvitation(orgId, email, role): Promise<Invitation>
cancelInvitation(orgId, invitationId): Promise<void>
resendInvitation(orgId, invitationId): Promise<void>
acceptInvitation(token): Promise<{ org: Org }>
removeMember(orgId, userId): Promise<void>
changeMemberRole(orgId, userId, role): Promise<void>
```

Frontend type in `apps/app/src/types/index.ts`:
```typescript
interface OrgInvitation {
  id: string;
  orgId: string;
  email: string;
  role: 'admin' | 'member';
  invitedBy: string | null;
  inviterName?: string;
  status: 'pending' | 'accepted' | 'canceled' | 'expired';
  expiresAt: string;
  createdAt: string;
}
```

#### 4.7 Role-Based Access Control

Currently all org members have equal access. With invites, we need to enforce roles:

**Read-only for `member` role** — members cannot:
- Modify org settings (`PATCH /orgs/:id`, `PATCH /orgs/:id/settings`)
- Manage AWS accounts (`POST /aws/accounts`, `DELETE /aws/accounts/:id`)
- Manage invitations
- Change subscription
- Trigger scans (debatable — could allow)

**Implementation**: Add `requireOrgAdmin` middleware or inline checks using `verifyOrgAdmin()` (already exists) on write endpoints. Scans are left writable for all members for now — can tighten later.

Endpoints to gate with admin check:
- `PATCH /orgs/:id` — update org
- `PATCH /orgs/:id/settings` — update settings
- `POST /aws/accounts` — add account
- `DELETE /aws/accounts/:id` — remove account
- `PATCH /aws/accounts/:id/scanners` — update scanners
- `POST /orgs/:id/subscription/upgrade` — change tier
- All invitation management endpoints

---

## Phase 5: Webhook Notifications

### Overview

Allow Team-tier organizations to register webhook URLs that receive HTTP POST notifications when specific events occur (scan completion, new critical findings, etc.). Payloads are signed with HMAC-SHA256 for verification.

### What Exists

| Component | File | Status |
|---|---|---|
| `canConfigureWebhooks` tier flag (Team-only) | `apps/api/src/types/index.ts` | Ready |
| Stripe webhook verification pattern (HMAC reference) | `apps/api/src/routes/stripe.ts:197-224` | Reference |
| Scaleway webhook bridge (safeCompare) | `apps/api/src/routes/webhooks.ts:94-104` | Reference |
| AES-256-GCM encryption helpers | `apps/api/src/lib/crypto.ts` | Reusable |
| Redis client with pipeline support | `apps/api/src/lib/redis.ts` | Ready |
| Logger with sensitive field redaction | `apps/api/src/lib/logger.ts` | Ready |

### Architecture

Workers update the database directly (no callback endpoint exists). Scan completion events are detected by the frontend via polling (`useScanCompletionRefresh` hook).

**Webhook trigger approach**: Since workers write directly to the DB, we have two options:

1. **DB trigger + LISTEN/NOTIFY** — PostgreSQL notifies the API when scans table changes. Complex, requires persistent connection.
2. **Polling cron** — Periodically check for completed scans and dispatch webhooks. Simple, but adds latency (up to poll interval).
3. **Worker callback** — Add a new internal endpoint that workers call on completion. Workers already know the API URL. **Recommended.**

**Recommended: Option 3 (Worker callback)**. Add `POST /internal/scan-complete` endpoint that workers call when scan finishes. The endpoint:
1. Updates scan status (already done by workers via DB)
2. Checks if org has webhook subscriptions
3. Dispatches webhook deliveries

The Go workers need a small addition: an HTTP POST to the API after updating the DB. This is the cleanest integration point.

For **finding-level events** (new critical/high finding), the trigger is during scan analysis by the worker. The same callback endpoint can include finding summary data.

### What Needs to Be Built

#### 5.1 Database: `orgWebhooks` + `webhookDeliveries` tables

Add to `apps/api/src/db/schema.ts`:

```
orgWebhooks
├── id              uuid PK
├── orgId           uuid FK → orgs.id (cascade delete)
├── url             varchar(2048) NOT NULL
├── secret          text NOT NULL              (encrypted with crypto.ts, used for HMAC signing)
├── events          jsonb NOT NULL             (array of event types to subscribe to)
├── enabled         boolean default true
├── description     varchar(255)
├── lastDeliveryAt  timestamp
├── lastStatusCode  integer
├── failCount       integer default 0          (consecutive failures, disable after threshold)
├── createdAt       timestamp default now()
├── updatedAt       timestamp default now()
```

```
webhookDeliveries
├── id              uuid PK
├── webhookId       uuid FK → orgWebhooks.id (cascade delete)
├── event           varchar(100) NOT NULL
├── payload         jsonb NOT NULL
├── statusCode      integer
├── responseBody    text                       (first 1KB, for debugging)
├── attempt         integer default 1
├── nextRetryAt     timestamp                  (null if delivered or max attempts reached)
├── deliveredAt     timestamp
├── createdAt       timestamp default now()
```

Index: `webhookDeliveries(webhookId, createdAt DESC)` for listing delivery history.

#### 5.2 Backend: Event Types

Define in `apps/api/src/types/index.ts`:

```typescript
type WebhookEventType =
  | 'scan.completed'      // Scan finished (complete or partial)
  | 'scan.failed'         // Scan errored
  | 'finding.new_critical' // New finding with severity = critical (if added) or high
  | 'finding.new_high'    // New finding with severity = high
  | 'member.joined'       // New member accepted invite (Phase 4)
  | 'member.removed';     // Member removed from org (Phase 4)
```

#### 5.3 Backend: `webhookService.ts`

New file: `apps/api/src/services/webhookService.ts`

```typescript
// CRUD
createWebhook(orgId: string, userId: string, data: CreateWebhookInput): Promise<Webhook>
  - Verify admin, verify Team tier
  - Generate random secret (32 bytes hex)
  - Encrypt secret before storing
  - Insert into orgWebhooks

updateWebhook(orgId: string, userId: string, webhookId: string, data: UpdateWebhookInput): Promise<Webhook>
deleteWebhook(orgId: string, userId: string, webhookId: string): Promise<void>
listWebhooks(orgId: string, userId: string): Promise<Webhook[]>
getWebhook(orgId: string, userId: string, webhookId: string): Promise<Webhook>
getDeliveryHistory(orgId: string, webhookId: string, limit?: number): Promise<Delivery[]>

// Dispatching
dispatchEvent(orgId: string, event: WebhookEventType, payload: Record<string, unknown>): Promise<void>
  - Find all enabled webhooks for this org subscribed to this event
  - For each: create delivery record, sign payload, send HTTP POST
  - On failure: increment failCount, schedule retry (exponential backoff)
  - Disable webhook after 10 consecutive failures

// Delivery
deliverWebhook(delivery: WebhookDelivery): Promise<void>
  - Decrypt webhook secret
  - Compute HMAC-SHA256 signature: HMAC(secret, JSON.stringify(payload))
  - POST to webhook URL with headers:
    - Content-Type: application/json
    - X-ScanOrbit-Signature: sha256={hex_signature}
    - X-ScanOrbit-Event: {event_type}
    - X-ScanOrbit-Delivery: {delivery_id}
    - X-ScanOrbit-Timestamp: {unix_timestamp}
  - Timeout: 10 seconds
  - Record statusCode + first 1KB of response body

// Test
sendTestEvent(orgId: string, userId: string, webhookId: string): Promise<Delivery>
  - Send a 'test' event with sample payload
  - Return delivery result immediately (no retry)

// Retry processing (called by cron)
processRetries(): Promise<number>
  - Find deliveries where nextRetryAt <= now and attempt < maxAttempts
  - Re-deliver, update attempt count
  - Exponential backoff: nextRetryAt = now + 60s * 2^(attempt-1)
  - Max 5 attempts
```

#### 5.4 Payload Formats

```typescript
// scan.completed / scan.failed
{
  event: 'scan.completed',
  timestamp: '2026-03-12T14:00:00Z',
  data: {
    scanId: 'uuid',
    awsAccountId: 'uuid',
    awsAccountName: 'production',
    status: 'complete',
    resourcesDiscovered: 142,
    resourcesDelta: 3,
    findingsNew: 5,
    findingsResolved: 2,
    duration: 45,  // seconds
  }
}

// finding.new_high
{
  event: 'finding.new_high',
  timestamp: '2026-03-12T14:00:00Z',
  data: {
    findingId: 'uuid',
    type: 'public_s3_bucket',
    severity: 'high',
    summary: 'S3 bucket "prod-uploads" allows public read access',
    awsAccountId: 'uuid',
    awsAccountName: 'production',
    resourceId: 'arn:aws:s3:::prod-uploads',
  }
}
```

#### 5.5 Backend: Internal Callback Endpoint

New route in `apps/api/src/routes/webhooks.ts` or a new `internal.ts`:

```
POST /internal/scan-complete   — Called by workers when scan finishes
```

Authenticated with a shared secret (env `INTERNAL_API_SECRET`), not JWT. Receives scan result summary and triggers `webhookService.dispatchEvent()`.

This is the primary trigger for `scan.completed`, `scan.failed`, `finding.new_critical`, and `finding.new_high` events.

Go worker change: After updating scan status in DB, POST to `{API_URL}/internal/scan-complete` with scan summary.

#### 5.6 Backend: API Routes

Add to `apps/api/src/routes/orgs.ts`:

```
GET    /orgs/:id/webhooks              — List webhooks (admin, Team-only)
POST   /orgs/:id/webhooks              — Create webhook (admin, Team-only)
GET    /orgs/:id/webhooks/:whId        — Get webhook details + recent deliveries
PATCH  /orgs/:id/webhooks/:whId        — Update webhook (url, events, enabled)
DELETE /orgs/:id/webhooks/:whId        — Delete webhook
POST   /orgs/:id/webhooks/:whId/test   — Send test event
```

Validation schemas:
```typescript
const createWebhookSchema = z.object({
  url: z.string().url().max(2048),
  events: z.array(z.enum(['scan.completed', 'scan.failed', 'finding.new_high', 'finding.new_critical', 'member.joined', 'member.removed'])).min(1),
  description: z.string().max(255).optional(),
});

const updateWebhookSchema = z.object({
  url: z.string().url().max(2048).optional(),
  events: z.array(z.enum([...])).min(1).optional(),
  enabled: z.boolean().optional(),
  description: z.string().max(255).optional(),
});
```

#### 5.7 Backend: Retry Cron

Add webhook retry processing to the existing cron infrastructure. Call `webhookService.processRetries()` every 60 seconds.

If no cron exists yet, add to `apps/api/src/index.ts` or a `cron.ts` module:
```typescript
setInterval(() => webhookService.processRetries(), 60_000);
```

#### 5.8 Frontend: Notifications Settings Tab

New component: `apps/app/src/components/settings/NotificationSettings.tsx`

Add as new tab in `apps/app/src/pages/Settings.tsx` (Team-only, admin-only).

UI sections:
1. **Webhook List** — cards showing each webhook: URL (truncated), subscribed events (badges), status (enabled/disabled, last delivery status), actions (edit, test, delete)
2. **Add Webhook Form** — URL input, event checkboxes, description, "Create Webhook" button. On create, show the signing secret once (masked afterward).
3. **Webhook Detail View** — expand/modal showing: full URL, events, secret (reveal button), recent delivery log (table: timestamp, event, status code, attempt, response preview)

Hooks in `apps/app/src/hooks/use-webhooks.ts`:
```typescript
useWebhooks(orgId)          — GET /orgs/:id/webhooks
useCreateWebhook()          — POST /orgs/:id/webhooks
useUpdateWebhook()          — PATCH /orgs/:id/webhooks/:id
useDeleteWebhook()          — DELETE /orgs/:id/webhooks/:id
useTestWebhook()            — POST /orgs/:id/webhooks/:id/test
```

API functions in `apps/app/src/lib/api.ts`:
```typescript
getWebhooks(orgId): Promise<Webhook[]>
createWebhook(orgId, data): Promise<Webhook & { secret: string }>
updateWebhook(orgId, webhookId, data): Promise<Webhook>
deleteWebhook(orgId, webhookId): Promise<void>
testWebhook(orgId, webhookId): Promise<WebhookDelivery>
```

Frontend types in `apps/app/src/types/index.ts`:
```typescript
interface OrgWebhook {
  id: string;
  orgId: string;
  url: string;
  events: string[];
  enabled: boolean;
  description: string | null;
  lastDeliveryAt: string | null;
  lastStatusCode: number | null;
  failCount: number;
  createdAt: string;
}

interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: string;
  statusCode: number | null;
  attempt: number;
  deliveredAt: string | null;
  createdAt: string;
}
```

---

## Implementation Order

```
Phase 4 (Team Members & Invites)
  4.1  DB migration: orgInvitations table
  4.2  invitationService.ts (create, accept, cancel, list, resend, removeMember, changeRole)
  4.3  Invitation email template in emailService.ts
  4.4  API routes (invitation CRUD + accept-invite + remove/change member)
  4.5  Role enforcement on existing write endpoints (verifyOrgAdmin)
  4.6  Frontend types + API functions
  4.7  TeamSettings.tsx component + Settings tab
  4.8  AcceptInvite.tsx page + router entry
  4.9  Tests

Phase 5 (Webhook Notifications)
  5.1  DB migration: orgWebhooks + webhookDeliveries tables
  5.2  Event types definition
  5.3  webhookService.ts (CRUD, dispatch, deliver, retry)
  5.4  Internal scan-complete callback endpoint
  5.5  API routes (webhook CRUD + test)
  5.6  Retry cron
  5.7  Frontend types + API functions
  5.8  NotificationSettings.tsx component + Settings tab
  5.9  Go worker: add HTTP POST callback after scan completion
  5.10 Tests
```

## Key Files to Modify

### Phase 4
| File | Change |
|---|---|
| `apps/api/src/db/schema.ts` | Add orgInvitations table |
| `apps/api/src/services/invitationService.ts` | **New** — invitation CRUD + member management |
| `apps/api/src/services/emailService.ts` | Add sendInvitationEmail() |
| `apps/api/src/routes/orgs.ts` | Add invitation + member management endpoints |
| `apps/api/src/routes/auth.ts` | Add POST /auth/accept-invite |
| `apps/app/src/types/index.ts` | Add OrgInvitation type |
| `apps/app/src/lib/api.ts` | Add invitation + member API functions |
| `apps/app/src/hooks/use-members.ts` | **New** — TanStack Query hooks |
| `apps/app/src/components/settings/TeamSettings.tsx` | **New** — member + invite management UI |
| `apps/app/src/pages/Settings.tsx` | Add Team tab |
| `apps/app/src/pages/AcceptInvite.tsx` | **New** — invite acceptance page |
| `apps/app/src/App.tsx` (or router config) | Add /invite/:token route |

### Phase 5
| File | Change |
|---|---|
| `apps/api/src/db/schema.ts` | Add orgWebhooks + webhookDeliveries tables |
| `apps/api/src/types/index.ts` | Add WebhookEventType |
| `apps/api/src/services/webhookService.ts` | **New** — webhook CRUD + dispatch + retry |
| `apps/api/src/routes/orgs.ts` | Add webhook CRUD + test endpoints |
| `apps/api/src/routes/webhooks.ts` | Add POST /internal/scan-complete |
| `apps/api/src/lib/config.ts` | Add INTERNAL_API_SECRET |
| `apps/app/src/types/index.ts` | Add OrgWebhook, WebhookDelivery types |
| `apps/app/src/lib/api.ts` | Add webhook API functions |
| `apps/app/src/hooks/use-webhooks.ts` | **New** — TanStack Query hooks |
| `apps/app/src/components/settings/NotificationSettings.tsx` | **New** — webhook management UI |
| `apps/app/src/pages/Settings.tsx` | Add Notifications tab |
| `workers/cmd/scanner/main.go` | Add HTTP POST callback on scan completion |
