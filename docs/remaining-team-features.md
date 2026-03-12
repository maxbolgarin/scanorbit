# Remaining Team Plan Features — Implementation Spec

## Status

Phases 1-3 are complete (maxAccounts enforcement, scan priority, tier-based retention, data export, audit logs). Two features remain:

- **Phase 4**: Team Members & Invites (with per-seat billing)
- **Phase 5**: Webhook Notifications

---

## Phase 4: Team Members & Invites

### Overview

Allow Team-tier organizations to invite people by email. Invitees receive a token-based link; if they don't have an account, they sign up through the link and are auto-attached to the org.

**Pricing model**: Team plan ($79/mo) includes 5 seats. Each additional seat costs $10/mo, billed automatically via Stripe when invite is accepted. All billing changes require prominent confirmation dialogs.

**Roles**: `admin` (full access, can invite/manage) vs `member` (read-only).

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
| Stripe subscription (customerId, subscriptionId on orgs) | `apps/api/src/services/stripeService.ts` | Ready |
| Stripe checkout/portal/switch/cancel flows | `apps/api/src/routes/stripe.ts` | Ready |

### Seat Billing Design

**Stripe integration**:
- Current Team subscription has 1 line item (team base price, quantity=1)
- Add a second subscription item for seats: `STRIPE_SEAT_PRICE_ID` env var
- The seat item uses `quantity` = number of paid seats (members beyond 5)
- When member #6 joins → `stripe.subscriptionItems.update(seatItemId, { quantity: 1 })` with proration
- When a member is removed and count drops below 6 → remove seat item or set quantity=0

**Constants**:
```typescript
const INCLUDED_SEATS = 5;    // Free seats included with Team plan
const SEAT_PRICE_MONTHLY = 10; // $10/seat/month (for display only, actual price from Stripe)
```

**Billing flows**:
1. **Invite member #1-5** → No billing change. Standard invite flow.
2. **Invite member #6+** → Before creating invitation:
   - Calculate: `paidSeats = max(0, currentMembers + pendingInvitations - INCLUDED_SEATS + 1)`
   - Return billing preview to frontend: `{ willAddPaidSeat: true, newMonthlyTotal: 89, proratedCharge: 3.50 }`
   - Frontend shows confirmation dialog (see below)
   - Admin confirms → create invitation + update Stripe seat quantity
3. **Member removed (was paid seat)** → Update Stripe quantity down by 1
   - Frontend shows notice: "Removing this member will reduce your bill by $10/mo"
4. **Invitation canceled (was going to be paid seat)** → No Stripe change (seat added on accept, not invite)

**Decision**: Stripe seat quantity updates on **accept** (not invite creation), because:
- Admin shouldn't be charged for invites that are never accepted
- But the invite dialog must warn that accepting will trigger billing

**Revised flow**:
1. Admin invites member #6 → dialog warns: "If accepted, this will add a paid seat ($10/mo)"
2. Invite is created (no Stripe change yet)
3. Invitee accepts → `acceptInvitation()` adds user to org AND updates Stripe seat quantity
4. Member removed → Stripe quantity decremented

### Frontend Confirmation Dialogs

**Invite dialog (paid seat)**:
```
⚠️ Paid Seat Required

Your Team plan includes 5 members. You currently have 5 active members.

Adding {email} will add a paid seat at $10/month to your subscription.
Your estimated monthly bill will increase from $79 to $89.

The charge will apply when the invitation is accepted.

[Cancel]  [Send Invite — $10/mo extra]
```

**Remove member dialog (reduces billing)**:
```
Remove {name} from {orgName}?

They will lose access to all organization resources immediately.
Your monthly bill will decrease by $10/mo (from $89 to $79).

[Cancel]  [Remove Member]
```

**Remove member dialog (within included seats)**:
```
Remove {name} from {orgName}?

They will lose access to all organization resources immediately.

[Cancel]  [Remove Member]
```

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
├── token           varchar(255) UNIQUE NOT NULL   (crypto.randomUUID)
├── status          varchar(50) default 'pending'  ('pending' | 'accepted' | 'canceled' | 'expired')
├── expiresAt       timestamp NOT NULL             (7 days from creation)
└── createdAt       timestamp default now()
```

Indexes: unique on (orgId, email) where status = 'pending' (prevent duplicate pending invites), index on token (for lookup).

Run migration: `pnpm drizzle-kit generate` then `pnpm drizzle-kit migrate`.

#### 4.2 Stripe: Seat Price Configuration

**New env var**: `STRIPE_SEAT_PRICE_ID` — a recurring monthly price in Stripe ($10/mo).

Add to `apps/api/src/lib/config.ts`:
```typescript
stripeConfig.seatPriceId: process.env.STRIPE_SEAT_PRICE_ID || '',
```

Add to `apps/api/src/services/stripeService.ts`:
```typescript
// Get current seat count from Stripe subscription
async getSeatItemInfo(orgId: string): Promise<{ itemId: string | null; quantity: number }>
  - Get subscription from Stripe
  - Find subscription item matching seatPriceId
  - Return itemId + quantity (0 if no seat item exists)

// Update paid seat count (called on member join/leave)
async updateSeatQuantity(orgId: string, newQuantity: number): Promise<void>
  - If newQuantity > 0 and no seat item → add subscription item with quantity
  - If newQuantity > 0 and seat item exists → update quantity (prorate)
  - If newQuantity <= 0 and seat item exists → remove subscription item
  - Use proration_behavior: 'create_prorations' for immediate billing

// Get billing preview for adding a seat
async getSeatBillingPreview(orgId: string): Promise<{
  willAddPaidSeat: boolean;
  currentPaidSeats: number;
  newPaidSeats: number;
  seatPriceMonthly: number;
  newMonthlyTotal: number;
}>
```

#### 4.3 Backend: `invitationService.ts`

New file: `apps/api/src/services/invitationService.ts`

```typescript
// Create invitation — admin-only, Team-only
createInvitation(orgId: string, adminUserId: string, email: string, role: 'admin' | 'member'): Promise<{
  invitation: Invitation;
  billing: { willAddPaidSeat: boolean; newMonthlyTotal: number; }
}>
  - Verify admin via orgService.verifyOrgAdmin()
  - Check TIER_LIMITS[tier].canInviteMembers → 403 if not Team
  - Check email isn't already a member (by email lookup in users + userOrgMembers)
  - Check no pending invitation for this email in this org
  - Calculate billing impact: count members + pending invites vs INCLUDED_SEATS
  - Generate token (crypto.randomUUID())
  - Insert into orgInvitations
  - Send invitation email via emailService
  - Return invitation + billing preview

// Accept invitation — called by the invitee (logged in or just signed up)
acceptInvitation(token: string, userId: string): Promise<{ org: Org }>
  - Find invitation by token, verify status = 'pending' and not expired
  - Check user isn't already in the org
  - In transaction:
    - Insert into userOrgMembers with invitation's role
    - Update invitation status to 'accepted'
  - After transaction: update Stripe seat quantity if now beyond INCLUDED_SEATS
  - Return org data for auth token refresh

// Cancel invitation — admin-only
cancelInvitation(orgId: string, adminUserId: string, invitationId: string): Promise<void>
  - Verify admin
  - Update invitation status to 'canceled'

// List pending invitations — admin-only
listInvitations(orgId: string, adminUserId: string): Promise<Invitation[]>
  - Return pending invitations for the org with inviter name

// Resend invitation — admin-only
resendInvitation(orgId: string, adminUserId: string, invitationId: string): Promise<void>
  - Verify invitation is still pending and not expired
  - Resend email, extend expiresAt by 7 days

// Remove member — admin-only, cannot remove self if last admin
removeMember(orgId: string, adminUserId: string, memberUserId: string): Promise<void>
  - Verify admin
  - Prevent removing the last admin
  - Delete from userOrgMembers
  - Update Stripe seat quantity down if was paid seat

// Change member role — admin-only
changeMemberRole(orgId: string, adminUserId: string, memberUserId: string, role: 'admin' | 'member'): Promise<void>
  - Verify admin
  - Prevent demoting the last admin
  - Update role in userOrgMembers

// Get seat/billing info for the org (used by frontend)
getSeatInfo(orgId: string): Promise<{
  totalMembers: number;
  pendingInvitations: number;
  includedSeats: number;       // 5
  paidSeats: number;           // max(0, totalMembers - 5)
  seatPriceMonthly: number;    // 10
}>
```

#### 4.4 Backend: Invitation Email

Add to `apps/api/src/services/emailService.ts`:

```typescript
sendInvitationEmail(email: string, inviterName: string, orgName: string, token: string): Promise<void>
```

Template: branded HTML email with "Join {orgName}" CTA button linking to `{frontendUrl}/invite/{token}`.

The link works for both existing and new users:
- Existing user → logs in → auto-redirected to accept invite
- New user → signs up → auto-redirected to accept invite

#### 4.5 Backend: API Routes

Add to `apps/api/src/routes/orgs.ts` (under audit logs section):

```
POST   /orgs/:id/invitations              — Create invitation (admin, Team-only)
GET    /orgs/:id/invitations              — List pending invitations (admin)
DELETE /orgs/:id/invitations/:invId       — Cancel invitation (admin)
POST   /orgs/:id/invitations/:invId/resend — Resend invitation email (admin)
DELETE /orgs/:id/members/:userId          — Remove member (admin)
PATCH  /orgs/:id/members/:userId          — Change member role (admin)
GET    /orgs/:id/seats                    — Get seat/billing info (admin)
```

Separate public route (no org context needed):
```
POST   /auth/accept-invite               — Accept invitation { token }
GET    /auth/invite-info/:token           — Get invitation info (org name, inviter) for display
```

These go in `apps/api/src/routes/auth.ts` since they're auth-adjacent (user needs to be logged in but doesn't need orgId in JWT yet). `invite-info` is unauthenticated so the invite page can show org name before login.

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

#### 4.6 Frontend: Invite Accept Page

New route: `/invite/:token` → new page `apps/app/src/pages/AcceptInvite.tsx`

Flow:
1. User lands on `/invite/{token}`
2. Call `GET /auth/invite-info/{token}` to display org name + inviter
3. If not logged in → show "Sign up to join {orgName}" + "Already have an account? Log in" with redirect back to `/invite/{token}`
4. If logged in → show "Join {orgName}?" with accept button
5. On accept → call `POST /auth/accept-invite` with token
6. On success → refresh auth store, switch to new org, redirect to dashboard
7. On error → show error (expired, already member, invalid token)

#### 4.7 Frontend: Team Members Settings Tab

New component: `apps/app/src/components/settings/TeamSettings.tsx`

Add as new tab in `apps/app/src/pages/Settings.tsx` (conditionally shown for Team tier, similar to Audit Log tab).

UI sections:
1. **Seat Usage Banner** — "Using 7 of 5 included seats (2 paid seats at $10/mo each)"
2. **Current Members** — table: Name, Email, Role (badge), Joined date, Actions (change role, remove). Admin-only actions.
3. **Pending Invitations** — table: Email, Role, Invited by, Sent date, Actions (resend, cancel). Admin-only.
4. **Invite Form** — email input + role select + "Send Invite" button. If adding paid seat, shows billing warning inline before submit. Only visible to admins.

Hooks in `apps/app/src/hooks/use-members.ts`:
```typescript
useOrgMembers(orgId)        — GET /orgs/:id/members
useOrgInvitations(orgId)    — GET /orgs/:id/invitations
useSeatInfo(orgId)          — GET /orgs/:id/seats
useInviteMember()           — POST /orgs/:id/invitations (with confirmation dialog)
useCancelInvitation()       — DELETE /orgs/:id/invitations/:id
useResendInvitation()       — POST /orgs/:id/invitations/:id/resend
useRemoveMember()           — DELETE /orgs/:id/members/:userId (with confirmation dialog)
useChangeMemberRole()       — PATCH /orgs/:id/members/:userId
```

API functions in `apps/app/src/lib/api.ts`:
```typescript
getOrgInvitations(orgId): Promise<Invitation[]>
createInvitation(orgId, email, role): Promise<{ invitation: Invitation; billing: BillingPreview }>
cancelInvitation(orgId, invitationId): Promise<void>
resendInvitation(orgId, invitationId): Promise<void>
acceptInvitation(token): Promise<{ org: Org }>
getInviteInfo(token): Promise<{ orgName: string; inviterName: string; email: string }>
removeMember(orgId, userId): Promise<void>
changeMemberRole(orgId, userId, role): Promise<void>
getSeatInfo(orgId): Promise<SeatInfo>
```

Frontend types in `apps/app/src/types/index.ts`:
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

interface SeatInfo {
  totalMembers: number;
  pendingInvitations: number;
  includedSeats: number;
  paidSeats: number;
  seatPriceMonthly: number;
}
```

#### 4.8 Role-Based Access Control

Currently all org members have equal access. With invites, enforce roles:

**Read-only for `member` role** — members cannot:
- Modify org settings (`PATCH /orgs/:id`, `PATCH /orgs/:id/settings`)
- Manage AWS accounts (`POST /aws/accounts`, `DELETE /aws/accounts/:id`)
- Manage invitations or members
- Change subscription
- Trigger scans (allowed — members can run scans but not modify config)

**Implementation**: Add `requireOrgAdmin` middleware or inline checks using `verifyOrgAdmin()` (already exists) on write endpoints.

Endpoints to gate with admin check:
- `PATCH /orgs/:id` — update org
- `PATCH /orgs/:id/settings` — update settings
- `POST /aws/accounts` — add account
- `DELETE /aws/accounts/:id` — remove account
- `PATCH /aws/accounts/:id/scanners` — update scanners
- `POST /orgs/:id/subscription/upgrade` — change tier
- All invitation/member management endpoints
- All webhook management endpoints (Phase 5)

#### 4.9 Landing Page & Subscription Settings Update

Update `apps/landing/src/components/Pricing.astro`:
- Team plan: "5 members included, $10/mo per additional seat"

Update `apps/app/src/components/settings/SubscriptionSettings.tsx`:
- Team features: "5 team members included (+$10/seat)"

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
  4.2  Stripe: add STRIPE_SEAT_PRICE_ID config + seat management methods in stripeService
  4.3  invitationService.ts (create, accept, cancel, list, resend, removeMember, changeRole, getSeatInfo)
  4.4  Invitation email template in emailService.ts
  4.5  API routes (invitation CRUD + accept-invite + invite-info + seats + remove/change member)
  4.6  Role enforcement on existing write endpoints (verifyOrgAdmin)
  4.7  Frontend types + API functions
  4.8  TeamSettings.tsx component + Settings tab (with billing confirmation dialogs)
  4.9  AcceptInvite.tsx page + router entry (supports sign-up flow)
  4.10 Update SubscriptionSettings + landing page pricing
  4.11 Tests

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
| `apps/api/src/lib/config.ts` | Add STRIPE_SEAT_PRICE_ID to stripeConfig |
| `apps/api/src/services/stripeService.ts` | Add getSeatItemInfo(), updateSeatQuantity(), getSeatBillingPreview() |
| `apps/api/src/services/invitationService.ts` | **New** — invitation CRUD + member management + seat billing |
| `apps/api/src/services/emailService.ts` | Add sendInvitationEmail() |
| `apps/api/src/routes/orgs.ts` | Add invitation + member + seats endpoints |
| `apps/api/src/routes/auth.ts` | Add POST /auth/accept-invite + GET /auth/invite-info/:token |
| `apps/app/src/types/index.ts` | Add OrgInvitation, SeatInfo types |
| `apps/app/src/lib/api.ts` | Add invitation + member + seats API functions |
| `apps/app/src/hooks/use-members.ts` | **New** — TanStack Query hooks |
| `apps/app/src/components/settings/TeamSettings.tsx` | **New** — member + invite management UI with billing dialogs |
| `apps/app/src/pages/Settings.tsx` | Add Team tab |
| `apps/app/src/pages/AcceptInvite.tsx` | **New** — invite acceptance page (supports sign-up) |
| `apps/app/src/App.tsx` (or router config) | Add /invite/:token route |
| `apps/app/src/components/settings/SubscriptionSettings.tsx` | Update Team features text |
| `apps/landing/src/components/Pricing.astro` | Update Team pricing to show seat info |

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
