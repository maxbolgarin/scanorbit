import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { Variables } from '../../types/index.js';

vi.mock('../../middlewares/auth.js', () => ({
  requireAuth: vi.fn(async (c: any, next: any) => {
    c.set('userId', 'test-user-id');
    c.set('orgId', 'test-org-id');
    await next();
  }),
}));

const { mockStripeService, mockOrgService, mockEmailService, mockListmonkService } = vi.hoisted(() => ({
  mockStripeService: {
    isConfigured: vi.fn().mockReturnValue(true),
    createCheckoutSession: vi.fn(),
    createPortalSession: vi.fn(),
    cancelSubscription: vi.fn(),
    switchPlan: vi.fn(),
    constructWebhookEvent: vi.fn(),
    handleCheckoutComplete: vi.fn(),
    handleSubscriptionChange: vi.fn(),
    handlePaymentFailed: vi.fn(),
    getSubscription: vi.fn(),
  },
  mockOrgService: {
    getOrgAdminEmail: vi.fn().mockResolvedValue(null),
  },
  mockEmailService: {
    sendTrialEndingEmail: vi.fn().mockResolvedValue(undefined),
    sendPaymentFailedEmail: vi.fn().mockResolvedValue(undefined),
  },
  mockListmonkService: {
    onTrialStart: vi.fn().mockResolvedValue(undefined),
    onPayment: vi.fn().mockResolvedValue(undefined),
    onPlanChange: vi.fn().mockResolvedValue(undefined),
    onChurn: vi.fn().mockResolvedValue(undefined),
    updateAttribsByEmail: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../services/stripeService.js', () => ({
  stripeService: mockStripeService,
}));

vi.mock('../../services/orgService.js', () => ({
  orgService: mockOrgService,
}));

vi.mock('../../services/emailService.js', () => ({
  emailService: mockEmailService,
}));

vi.mock('../../services/listmonkService.js', () => ({
  listmonkService: mockListmonkService,
}));

vi.mock('../../services/dripSchedulerService.js', () => ({
  sendImmediate: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../lib/metrics.js', () => ({
  errorsTotal: { inc: vi.fn() },
}));

vi.mock('../../lib/config.js', () => ({
  config: {
    frontendUrl: 'http://localhost:3000',
  },
  stripeConfig: {
    teamPriceId: 'price_team',
  },
}));

import stripeRoute from '../../routes/stripe.js';
import { errorHandler } from '../../middlewares/errorHandler.js';

describe('Stripe Routes', () => {
  let app: Hono<{ Variables: Variables }>;

  beforeEach(() => {
    app = new Hono<{ Variables: Variables }>();
    app.route('/stripe', stripeRoute);
    app.onError(errorHandler);
    vi.clearAllMocks();
    mockStripeService.isConfigured.mockReturnValue(true);
  });

  describe('POST /stripe/checkout', () => {
    it('creates checkout session', async () => {
      mockStripeService.createCheckoutSession.mockResolvedValue({
        url: 'https://checkout.stripe.com/session',
      });

      const res = await app.request('/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetTier: 'pro' }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.url).toContain('stripe.com');
    });

    it('rejects invalid tier', async () => {
      const res = await app.request('/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetTier: 'enterprise' }),
      });
      expect(res.status).toBe(400);
    });

    it('returns 400 when stripe not configured', async () => {
      mockStripeService.isConfigured.mockReturnValue(false);

      const res = await app.request('/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetTier: 'pro' }),
      });
      expect(res.status).toBe(400);
    });

    it('rejects redirect URL on different origin', async () => {
      const res = await app.request('/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetTier: 'pro',
          successUrl: 'https://evil.com/phish',
        }),
      });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /stripe/portal', () => {
    it('creates portal session', async () => {
      mockStripeService.createPortalSession.mockResolvedValue({
        url: 'https://billing.stripe.com/portal',
      });

      const res = await app.request('/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(200);
    });
  });

  describe('POST /stripe/cancel', () => {
    it('cancels subscription', async () => {
      mockStripeService.cancelSubscription.mockResolvedValue(undefined);

      const res = await app.request('/stripe/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.canceled).toBe(true);
    });
  });

  describe('POST /stripe/switch-plan', () => {
    it('switches plan', async () => {
      mockStripeService.switchPlan.mockResolvedValue(undefined);

      const res = await app.request('/stripe/switch-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetTier: 'team' }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.switched).toBe(true);
      expect(body.data.targetTier).toBe('team');
    });
  });

  describe('POST /stripe/webhook', () => {
    it('returns 400 without signature', async () => {
      const res = await app.request('/stripe/webhook', {
        method: 'POST',
        body: '{}',
      });
      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid signature', async () => {
      mockStripeService.constructWebhookEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      const res = await app.request('/stripe/webhook', {
        method: 'POST',
        headers: { 'stripe-signature': 'invalid' },
        body: '{}',
      });
      expect(res.status).toBe(400);
    });

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

    it('returns 503 when stripe not configured', async () => {
      mockStripeService.isConfigured.mockReturnValue(false);

      const res = await app.request('/stripe/webhook', {
        method: 'POST',
        body: '{}',
      });
      expect(res.status).toBe(503);
    });
  });
});
