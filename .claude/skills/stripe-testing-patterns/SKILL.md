---
name: stripe-testing-patterns
description: Stripe integration testing with vi.mock, webhook handling, subscription flows. Use when writing or modifying Stripe-related tests.
---

# Stripe Testing Patterns

Patterns for testing Stripe integration in this project's Vitest test suite.

## Key Files

- `apps/api/src/services/stripeService.ts` — Stripe service (990 lines)
- `apps/api/src/routes/stripe.ts` — HTTP endpoints + webhooks (517 lines)
- `apps/api/src/test/services/stripeService.test.ts` — Service tests
- `apps/api/src/test/routes/stripe.test.ts` — Route tests
- `apps/api/src/lib/config.ts` — `stripeConfig` definition
- `apps/api/src/types/index.ts` — `SubscriptionTier`, `TIER_LIMITS`, `SEAT_BILLING`

## Mock Setup: Stripe SDK

Use `vi.hoisted()` to create mock functions, then `vi.mock('stripe')` with a MockStripe class:

```typescript
const {
  mockStripeCustomersCreate,
  mockStripeCustomersDel,
  mockStripeCustomersRetrieve,
  mockStripeCheckoutCreate,
  mockStripePortalCreate,
  mockStripeSubscriptionsRetrieve,
  mockStripeSubscriptionsUpdate,
  mockStripeSubscriptionsCancel,
  mockStripeWebhooksConstruct,
} = vi.hoisted(() => ({
  mockStripeCustomersCreate: vi.fn(),
  mockStripeCustomersDel: vi.fn(),
  mockStripeCustomersRetrieve: vi.fn(),
  mockStripeCheckoutCreate: vi.fn(),
  mockStripePortalCreate: vi.fn(),
  mockStripeSubscriptionsRetrieve: vi.fn(),
  mockStripeSubscriptionsUpdate: vi.fn(),
  mockStripeSubscriptionsCancel: vi.fn(),
  mockStripeWebhooksConstruct: vi.fn(),
}));

vi.mock('stripe', () => {
  class MockStripe {
    customers = {
      create: mockStripeCustomersCreate,
      del: mockStripeCustomersDel,
      retrieve: mockStripeCustomersRetrieve,
    };
    checkout = {
      sessions: { create: mockStripeCheckoutCreate },
    };
    billingPortal = {
      sessions: { create: mockStripePortalCreate },
    };
    subscriptions = {
      retrieve: mockStripeSubscriptionsRetrieve,
      update: mockStripeSubscriptionsUpdate,
      cancel: mockStripeSubscriptionsCancel,
    };
    webhooks = {
      constructEvent: mockStripeWebhooksConstruct,
    };
  }
  return { default: MockStripe };
});
```

## Mock Setup: Stripe Config

```typescript
vi.mock('../../lib/config.js', () => ({
  stripeConfig: {
    secretKey: 'sk_test_123',
    webhookSecret: 'whsec_test',
    proPriceId: 'price_pro',
    teamPriceId: 'price_team',
    seatPriceId: 'price_seat',
    trialDays: 14,
  },
}));
```

## Mock Setup: Database

Use `createChain()` from `test/helpers/mockDb.ts` with mutable result arrays:

```typescript
let selectResult: unknown[] = [];
let updateResult: unknown[] = [];

vi.mock('../../lib/db.js', () => ({
  db: {
    select: vi.fn(() => createChain(selectResult)),
    update: vi.fn(() => createChain(updateResult)),
    transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

beforeEach(async () => {
  vi.clearAllMocks();
  selectResult = [];
  updateResult = [];
  const { db } = await import('../../lib/db.js');
  vi.mocked(db.select).mockImplementation(() => createChain(selectResult) as any);
  vi.mocked(db.update).mockImplementation(() => createChain(updateResult) as any);
  mockTransaction.mockImplementation(async (fn: any) => {
    const tx = {
      select: vi.fn(() => createChain([]) as any),
      update: vi.fn(() => createChain([]) as any),
    };
    return fn(tx);
  });
});
```

## Sequential Query Mocking

When a service makes multiple DB queries, chain `mockImplementationOnce`:

```typescript
vi.mocked(db.select)
  .mockImplementationOnce(() => createChain([{ subscriptionStatus: 'none' }]) as any)
  .mockImplementationOnce(() => createChain([{ stripeCustomerId: null, name: 'Acme' }]) as any)
  .mockImplementationOnce(() => createChain([{ email: 'owner@example.com' }]) as any);
```

## Testing Webhook Handlers

### Route-level webhook test:

```typescript
it('handles checkout.session.completed', async () => {
  mockStripeService.constructWebhookEvent.mockReturnValue({
    type: 'checkout.session.completed',
    id: 'evt_1',
    data: { object: { metadata: { orgId: 'org-1' } } },
  });

  const res = await app.request('/stripe/webhook', {
    method: 'POST',
    headers: { 'stripe-signature': 'valid-sig' },
    body: '{}',
  });

  expect(res.status).toBe(200);
  expect(mockStripeService.handleCheckoutComplete).toHaveBeenCalled();
});
```

### Webhook deduplication uses Redis NX+EX:

```typescript
// redis.set(`stripe:event:${eventId}`, '1', 'EX', TTL, 'NX') returns 'OK' if new
// Falls back to allowing processing if Redis is unavailable
```

## Trial Management

### Timestamp conversion (critical gotcha):

Stripe uses **Unix seconds**, JavaScript uses **milliseconds**:

```typescript
// JS Date → Stripe: Math.floor(date.getTime() / 1000)
// Stripe → JS Date: new Date(stripeTimestamp * 1000)
```

### Trial preservation test:

```typescript
it('preserves trial_end when org is currently trialing', async () => {
  const trialEnd = new Date('2026-03-23T11:02:00Z');
  vi.mocked(db.select)
    .mockImplementationOnce(() => createChain([{
      subscriptionStatus: 'trialing',
      trialUsedAt: new Date('2026-03-16'),
      trialEndsAt: trialEnd,
    }]) as any);

  await stripeService.createCheckoutSession(...);

  expect(mockStripeCheckoutCreate).toHaveBeenCalledWith(expect.objectContaining({
    subscription_data: expect.objectContaining({
      trial_end: Math.floor(trialEnd.getTime() / 1000),
    }),
  }));
});
```

## Plan Switching

```typescript
expect(mockStripeSubscriptionsUpdate).toHaveBeenCalledWith('sub_123', {
  items: [{ id: 'si_123', price: 'price_team' }],
  proration_behavior: 'none',
  automatic_tax: { enabled: true },
  metadata: { targetTier: 'team' },
});
```

## Cancellation

- **Period-end**: `subscriptions.update('sub_id', { cancel_at_period_end: true })`
- **Immediate**: `subscriptions.cancel('sub_id')`

## Subscription Status Mapping

The service maps Stripe statuses: `paused` → `active`, `incomplete`/`incomplete_expired` → `none`.

## Common Mistakes

- Forgetting to convert between seconds and milliseconds for Stripe timestamps
- Not mocking sequential DB queries when service makes multiple selects
- Not restoring mock implementations in `beforeEach` after `vi.clearAllMocks()`
- Missing `mockTransaction` setup when testing code that uses `db.transaction()`
- Forgetting that seat price items must be filtered out when deriving plan tier
