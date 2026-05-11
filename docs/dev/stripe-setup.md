# Stripe Setup Guide

How to configure Stripe payments for ScanOrbit.

## Prerequisites

- A Stripe account at [dashboard.stripe.com](https://dashboard.stripe.com)
- Test mode works immediately; live mode requires business verification

## 1. Create Products & Prices

In Stripe Dashboard, go to **Product catalog** and create subscription products:

| Product | Price | Billing |
|---------|-------|---------|
| Pro     | $19   | Monthly, recurring |
| Team    | $79   | Monthly, recurring |
| Additional Seat | $10 | Monthly, recurring (optional, Team plan only) |

After creating each product, note the **Price ID** (starts with `price_...`). You'll find it on the product page under the pricing section.

The Seat product is used for Team plans with more than 5 members. Each additional member beyond the 5 included seats costs $10/month. This product is optional — seat billing is skipped if `STRIPE_SEAT_PRICE_ID` is not configured.

## 2. Get API Keys

Go to **Developers** > **API keys**.

- **Test mode**: `sk_test_...` (use during development)
- **Live mode**: `sk_live_...` (use in production, requires business verification)

Copy the **Secret key** (not the publishable key — the backend uses the secret key only).

## 3. Set Up Webhook Endpoint

Go to **Developers** > **Webhooks** > **Add endpoint**.

- **Endpoint URL**: `https://<your-api-domain>/stripe/webhook`
  - Example: `https://api.scanorbit.io/stripe/webhook`
- **Events to listen for** (click "Select events"):
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `customer.subscription.trial_will_end`
  - `invoice.payment_failed`

After creating the endpoint, click **Reveal** under "Signing secret" and copy the `whsec_...` value.

## 4. Configure Customer Portal

Go to **Settings** > **Billing** > **Customer portal**.

Enable these features:
- **Payment methods** — allow customers to update their card
- **Cancel subscription** — allow customers to cancel
- **Switch plans** — allow customers to change between Pro and Team (add both prices)

The portal is used for active (post-trial) subscribers to manage their subscription. Trialing users switch plans via the app's own `POST /stripe/switch-plan` endpoint which preserves the trial period.

## 5. Environment Variables

Add these to your API environment (`.env`, `.env.prod`, or deployment config):

```bash
# Required — Stripe activates when all four are set
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_TEAM_PRICE_ID=price_...

# Optional
STRIPE_SEAT_PRICE_ID=price_...   # for Team seat billing (omit to disable)
STRIPE_TRIAL_DAYS=7              # trial length in days (default: 7)
```

When all four required variables are set, `stripeService.isConfigured()` returns `true` and the checkout/portal/webhook flows activate. Without them, the app falls back to a demo mode where tier changes are applied directly via `POST /orgs/:id/subscription/upgrade`.

## 6. Local Development

### Install Stripe CLI

```bash
# macOS
brew install stripe/stripe-cli/stripe

# Login to your Stripe account
stripe login
```

### Forward webhooks to localhost

```bash
stripe listen --forward-to localhost:4000/stripe/webhook
```

This prints a webhook signing secret (`whsec_...`) — use it as `STRIPE_WEBHOOK_SECRET` in your local `.env`.

### Test a checkout flow

1. Start the API and app locally (`make dev`)
2. Log in, go to Settings > Subscription
3. Click "Start 7-Day Free Trial" on Pro or Team
4. Use test card: `4242 4242 4242 4242`, any future expiry date, any CVC, any billing details
5. Complete checkout — you should be redirected back to the Subscription tab with a success message

### Useful test cards

| Card | Behavior |
|------|----------|
| `4242 4242 4242 4242` | Succeeds |
| `4000 0000 0000 3220` | Requires 3D Secure |
| `4000 0000 0000 9995` | Declines (insufficient funds) |

### Trigger webhook events manually

```bash
# Simulate trial ending soon
stripe trigger customer.subscription.trial_will_end

# Simulate payment failure
stripe trigger invoice.payment_failed
```

## 7. How It Works

### Subscription flow

1. User clicks "Start 7-Day Free Trial" on Pro or Team plan
2. Frontend calls `POST /stripe/checkout` with the target tier
3. Backend creates a Stripe customer (if not exists) and a Checkout Session with a trial period
4. User is redirected to Stripe's hosted checkout page
5. After completing checkout, user is redirected back to `/settings?tab=subscription&success=true`
6. Frontend calls `POST /stripe/sync` to pull the subscription state immediately (doesn't wait for webhook)
7. Stripe sends `checkout.session.completed` webhook asynchronously
8. Backend updates the org's tier, subscription status, and trial end date

### Plan switching

- **During trial**: Frontend calls `POST /stripe/switch-plan` which changes the Stripe price while preserving the trial period (no proration, no early charge)
- **After trial (active subscription)**: Frontend opens the Stripe Customer Portal via `POST /stripe/portal`, where the user can switch plans with prorated billing

### Cancellation

- Frontend calls `POST /stripe/cancel` with `{ immediate: false }` to cancel at period end (graceful) or `{ immediate: true }` to cancel immediately
- Users can also cancel via the Stripe Customer Portal
- Stripe sends webhooks for all changes, which the backend processes to keep the org in sync

### Manual sync

`POST /stripe/sync` pulls the current subscription state directly from the Stripe API. This is a fallback for when webhooks fail to deliver. The endpoint tries the stored subscription ID first, then falls back to listing the customer's subscriptions.

### Seat billing (Team plan)

Team plans include 5 seats. Additional members cost $10/month each. Seat billing is managed automatically:

- When a member accepts an invitation, the backend counts total members and updates the seat quantity on Stripe
- When a member is removed, the seat count is adjusted down
- Seat updates use absolute quantities (idempotent) and create prorations

Seat billing requires `STRIPE_SEAT_PRICE_ID` to be configured. Without it, seat updates are silently skipped.

## 8. API Endpoints

All authenticated endpoints require a valid JWT and org admin role. Rate limited to 10 requests per minute per user.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/stripe/checkout` | JWT + admin | Create a checkout session to start a trial. Body: `{ targetTier: 'pro' \| 'team', successUrl?, cancelUrl? }`. Returns `{ sessionId, url }`. |
| `POST` | `/stripe/switch-plan` | JWT + admin | Switch plan while preserving trial. Body: `{ targetTier: 'pro' \| 'team' }`. Only allowed on active/trialing subscriptions. |
| `POST` | `/stripe/portal` | JWT + admin | Create a Customer Portal session. Body: `{ returnUrl? }`. Returns `{ url }`. |
| `POST` | `/stripe/cancel` | JWT + admin | Cancel subscription. Body: `{ immediate?: boolean }`. Default: cancel at period end. |
| `POST` | `/stripe/sync` | JWT + admin | Sync subscription state from Stripe API. No body. Returns `{ synced, tier }`. |
| `POST` | `/stripe/webhook` | Stripe signature | Webhook handler. No auth — verified by `stripe-signature` header. |

Additional endpoints on the org routes:

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/orgs/:id/subscription` | JWT | Get subscription status (tier, limits, scan eligibility, trial dates). |
| `POST` | `/orgs/:id/subscription/upgrade` | JWT + admin | Legacy tier change. When Stripe is configured, only allows downgrade to free (triggers cancellation). When Stripe is not configured, directly updates the tier (demo mode). |

## 9. Tier Mapping

| Tier | Price | AWS Accounts | Scans | Key Features |
|------|-------|-------------|-------|--------------|
| Free | $0 | 1 | 1 successful scan (unlimited retries) | Dashboard statistics only |
| Pro | $19/mo | 3 | Every 60 minutes | Resource/finding lists, infrastructure map |
| Team | $79/mo | 10 | Unlimited (priority) | Everything in Pro + org overview, data export, audit logs, API keys, 5 team members (+$10/seat) |

## 10. Webhook Events

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Set tier, subscription ID, trial dates. Send Telegram notification. Move subscriber to trial-new list in Listmonk. |
| `customer.subscription.created` | Sync subscription status to org record. |
| `customer.subscription.updated` | Sync plan changes, handle trial-to-active transition (send payment confirmation email, update Listmonk), track cancellation scheduling. Send Telegram notification on activation/cancellation. |
| `customer.subscription.deleted` | Downgrade to free tier. Track churn in Listmonk (distinguishes trial churn from paid churn). |
| `customer.subscription.trial_will_end` | Send trial-ending email to org admin (only if still in trial). |
| `invoice.payment_failed` | Mark subscription as `past_due` (only if currently active/trialing). Send payment failed email. Send Telegram notification. |

## 11. Reliability

### Rate limiting
All `/stripe/*` authenticated endpoints are rate limited to 10 requests per minute per user. The rate limiter is configured to fail open (authenticated users aren't blocked by Redis failures).

### Webhook deduplication
Webhook events are deduplicated using Redis `SET NX` with a 24-hour TTL. If Redis is unavailable, events are processed anyway (missing events is worse than duplicates). On processing failure, the dedup key is cleared so Stripe can retry.

### Webhook retry behavior
- Successful processing returns HTTP 200
- Processing failure returns HTTP 500, which triggers Stripe's automatic retry (up to 3 days with exponential backoff)
- When Stripe is not configured, returns HTTP 503 so events aren't marked as delivered

### Race condition protection
- Customer creation uses a conditional `UPDATE ... WHERE stripeCustomerId IS NULL` to prevent double-creation. If a race occurs, the orphan Stripe customer is deleted (retried up to 2 times)
- Checkout completion checks for existing subscriptions and cancels old ones to prevent orphaned billing
- Subscription updates read the previous status before writing to detect transitions correctly

### Tier derivation
The subscription tier is derived from the Stripe price ID (authoritative). If the price ID doesn't match known prices, metadata `targetTier` is used as a fallback. Seat price items are filtered out before tier derivation.

## 12. Going Live

1. **Verify your business** in Stripe Dashboard (business name, address, owner details, website URL)
2. **Create live products** — repeat step 1 in live mode to get live `price_...` IDs
3. **Create live webhook** — repeat step 3 with your production API URL
4. **Update environment variables** with live keys:
   ```bash
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_...       # from the live webhook
   STRIPE_PRO_PRICE_ID=price_...         # live price IDs
   STRIPE_TEAM_PRICE_ID=price_...
   STRIPE_SEAT_PRICE_ID=price_...        # if using seat billing
   ```
5. **Deploy** and test with a real card (you can refund immediately after)
