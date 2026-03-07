# Stripe Setup Guide

How to configure Stripe payments for ScanOrbit.

## Prerequisites

- A Stripe account at [dashboard.stripe.com](https://dashboard.stripe.com)
- Test mode works immediately; live mode requires business verification

## 1. Create Products & Prices

In Stripe Dashboard, go to **Product catalog** > **Create product**.

Create two subscription products:

| Product | Price | Billing |
|---------|-------|---------|
| Pro     | $19   | Monthly, recurring |
| Team    | $79   | Monthly, recurring |

After creating each product, note the **Price ID** (starts with `price_...`). You'll find it on the product page under the pricing section.

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

Save the portal configuration.

## 5. Environment Variables

Add these to your API environment (`.env`, `.env.prod`, or deployment config):

```bash
# Required — Stripe won't activate without all four
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_TEAM_PRICE_ID=price_...

# Optional — defaults to 14
STRIPE_TRIAL_DAYS=14
```

When all four required variables are set, `stripeService.isConfigured()` returns `true` and the checkout/portal/webhook flows activate automatically. Without them, the app falls back to a demo mode where tier changes are applied directly.

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

1. Start the API and app locally
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

1. User clicks "Start Free Trial" on Pro or Team plan
2. Frontend calls `POST /stripe/checkout` with the target tier
3. Backend creates a Stripe Checkout Session with a 7-day trial
4. User is redirected to Stripe's hosted checkout page
5. After completing checkout, user is redirected back to `/settings?tab=subscription`
6. Stripe sends `checkout.session.completed` webhook
7. Backend updates the org's tier, subscription status, and trial end date

### Subscription management

- Users manage their subscription (update card, cancel, switch plans) via the Stripe Customer Portal
- Frontend calls `POST /stripe/portal` to get a portal URL, then opens it
- Stripe sends webhooks for all changes, which the backend processes to keep the org in sync

### Tier mapping

| Tier | Price | Features |
|------|-------|----------|
| Free | $0    | 1 AWS account, 1 scan, dashboard stats only |
| Pro  | $19/mo | 1 AWS account, hourly scans, full resource/finding/infra access |
| Team | $79/mo | Unlimited AWS accounts, unlimited scans, org overview, team members |

### Webhook events handled

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Set tier, subscription ID, trial dates |
| `customer.subscription.created` | Sync subscription status |
| `customer.subscription.updated` | Sync plan changes, cancellation scheduling |
| `customer.subscription.deleted` | Downgrade to free tier |
| `customer.subscription.trial_will_end` | Send email notification to org admin |
| `invoice.payment_failed` | Mark as past_due, send email notification |

## 8. Going Live

1. **Verify your business** — click the banner in Stripe Dashboard and complete the verification form (business name, address, owner details, website URL)
2. **Create live products** — repeat step 1 in live mode to get live `price_...` IDs
3. **Create live webhook** — repeat step 3 with your production API URL
4. **Update environment variables** with live keys:
   ```bash
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_...     # from the live webhook
   STRIPE_PRO_PRICE_ID=price_...       # live price IDs
   STRIPE_TEAM_PRICE_ID=price_...
   ```
5. **Deploy** and test with a real card (you can refund immediately after)
