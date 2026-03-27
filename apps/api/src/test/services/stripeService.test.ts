import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createChain } from '../helpers/mockDb.js';

let selectResult: unknown[] = [];
let updateResult: unknown[] = [];
const mockTransaction = vi.fn();

vi.mock('../../lib/db.js', () => ({
  db: {
    select: vi.fn(() => createChain(selectResult)),
    update: vi.fn(() => createChain(updateResult)),
    transaction: (...args: unknown[]) => mockTransaction(...args),
  },
  pool: {},
}));

vi.mock('../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

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

vi.mock('../../services/orgService.js', () => ({
  verifyOrgAdmin: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../lib/metrics.js', () => ({
  subscriptionEventsTotal: { inc: vi.fn() },
  planSwitchesTotal: { inc: vi.fn() },
}));

vi.mock('../../lib/redis.js', () => ({
  redis: {
    set: vi.fn().mockResolvedValue('OK'),
    get: vi.fn().mockResolvedValue(null),
    del: vi.fn().mockResolvedValue(1),
  },
}));

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

import { stripeService } from '../../services/stripeService.js';

describe('stripeService', () => {
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

  describe('isConfigured', () => {
    it('returns true when all config present', () => {
      expect(stripeService.isConfigured()).toBe(true);
    });
  });

  describe('createCheckoutSession', () => {
    it('enables automatic tax and VAT ID collection in checkout', async () => {
      const { db } = await import('../../lib/db.js');
      vi.mocked(db.select)
        .mockImplementationOnce(() => createChain([{ subscriptionStatus: 'none' }]) as any)
        .mockImplementationOnce(() => createChain([{ stripeCustomerId: null, name: 'Acme' }]) as any)
        .mockImplementationOnce(() => createChain([{ email: 'owner@example.com', fullName: 'Owner' }]) as any);
      vi.mocked(db.update)
        .mockImplementationOnce(() => createChain([{ stripeCustomerId: 'cus_123' }]) as any);

      mockStripeCustomersCreate.mockResolvedValue({ id: 'cus_123' });
      mockStripeCheckoutCreate.mockResolvedValue({
        id: 'cs_123',
        url: 'https://checkout.stripe.com/session',
      });

      await stripeService.createCheckoutSession(
        'org-1',
        'user-1',
        'pro',
        'http://localhost/success',
        'http://localhost/cancel',
      );

      expect(mockStripeCheckoutCreate).toHaveBeenCalledWith(expect.objectContaining({
        customer: 'cus_123',
        mode: 'subscription',
        automatic_tax: { enabled: true },
        tax_id_collection: { enabled: true },
      }));
    });

    it('includes trial_period_days when org has never used one', async () => {
      const { db } = await import('../../lib/db.js');
      vi.mocked(db.select)
        .mockImplementationOnce(() => createChain([{ subscriptionStatus: 'none', trialUsedAt: null, trialEndsAt: null }]) as any)
        .mockImplementationOnce(() => createChain([{ stripeCustomerId: 'cus_existing' }]) as any);

      mockStripeCustomersRetrieve.mockResolvedValue({ id: 'cus_existing' });
      mockStripeCheckoutCreate.mockResolvedValue({ id: 'cs_123', url: 'https://checkout.stripe.com/session' });

      await stripeService.createCheckoutSession('org-1', 'user-1', 'pro', 'http://localhost/success', 'http://localhost/cancel');

      expect(mockStripeCheckoutCreate).toHaveBeenCalledWith(expect.objectContaining({
        subscription_data: expect.objectContaining({ trial_period_days: 14 }),
      }));
    });

    it('skips trial when org has already used one', async () => {
      const { db } = await import('../../lib/db.js');
      vi.mocked(db.select)
        .mockImplementationOnce(() => createChain([{ subscriptionStatus: 'canceled', trialUsedAt: new Date('2026-03-16'), trialEndsAt: null }]) as any)
        .mockImplementationOnce(() => createChain([{ stripeCustomerId: 'cus_existing' }]) as any);

      mockStripeCustomersRetrieve.mockResolvedValue({ id: 'cus_existing' });
      mockStripeCheckoutCreate.mockResolvedValue({ id: 'cs_456', url: 'https://checkout.stripe.com/session2' });

      await stripeService.createCheckoutSession('org-1', 'user-1', 'pro', 'http://localhost/success', 'http://localhost/cancel');

      const callArgs = mockStripeCheckoutCreate.mock.calls[0][0];
      expect(callArgs.subscription_data).not.toHaveProperty('trial_period_days');
      expect(callArgs.subscription_data).not.toHaveProperty('trial_end');
    });

    it('preserves trial_end timestamp when org is currently trialing', async () => {
      const trialEnd = new Date('2026-03-23T11:02:00Z');
      const { db } = await import('../../lib/db.js');
      vi.mocked(db.select)
        .mockImplementationOnce(() => createChain([{ subscriptionStatus: 'trialing', trialUsedAt: new Date('2026-03-16'), trialEndsAt: trialEnd }]) as any)
        .mockImplementationOnce(() => createChain([{ stripeCustomerId: 'cus_existing' }]) as any);

      mockStripeCustomersRetrieve.mockResolvedValue({ id: 'cus_existing' });
      mockStripeCheckoutCreate.mockResolvedValue({ id: 'cs_789', url: 'https://checkout.stripe.com/session3' });

      await stripeService.createCheckoutSession('org-1', 'user-1', 'team', 'http://localhost/success', 'http://localhost/cancel');

      expect(mockStripeCheckoutCreate).toHaveBeenCalledWith(expect.objectContaining({
        subscription_data: expect.objectContaining({ trial_end: Math.floor(trialEnd.getTime() / 1000) }),
      }));
    });

    it('throws 400 when org has an active (paid) subscription', async () => {
      const { db } = await import('../../lib/db.js');
      vi.mocked(db.select)
        .mockImplementationOnce(() => createChain([{ subscriptionStatus: 'active', trialUsedAt: new Date(), trialEndsAt: null }]) as any);

      await expect(
        stripeService.createCheckoutSession('org-1', 'user-1', 'pro', 'http://localhost/success', 'http://localhost/cancel')
      ).rejects.toThrow('already has an active subscription');
    });
  });

  describe('handleCheckoutComplete', () => {
    it('updates org on checkout completion', async () => {
      mockStripeSubscriptionsRetrieve.mockResolvedValue({
        status: 'trialing',
        trial_end: Math.floor(Date.now() / 1000) + 86400,
        cancel_at: null,
        items: { data: [{ price: { id: 'price_pro' } }] },
      });

      await stripeService.handleCheckoutComplete({
        id: 'cs_123',
        metadata: { orgId: 'org-1', targetTier: 'pro' },
        subscription: 'sub_123',
      } as any);

      const { db } = await import('../../lib/db.js');
      expect(db.update).toHaveBeenCalled();
    });

    it('skips when missing orgId', async () => {
      await stripeService.handleCheckoutComplete({
        id: 'cs_123',
        metadata: {},
      } as any);

      const { db } = await import('../../lib/db.js');
      expect(db.update).not.toHaveBeenCalled();
    });

    it('skips when missing subscription', async () => {
      await stripeService.handleCheckoutComplete({
        id: 'cs_123',
        metadata: { orgId: 'org-1' },
        subscription: null,
      } as any);

      const { db } = await import('../../lib/db.js');
      expect(db.update).not.toHaveBeenCalled();
    });
  });

  describe('handleSubscriptionChange', () => {
    it('updates org from subscription metadata', async () => {
      await stripeService.handleSubscriptionChange({
        id: 'sub_123',
        metadata: { orgId: 'org-1' },
        status: 'active',
        trial_end: null,
        cancel_at: null,
        items: { data: [{ price: { id: 'price_pro' } }] },
      } as any);

      const { db } = await import('../../lib/db.js');
      expect(db.update).toHaveBeenCalled();
    });

    it('looks up org by subscription ID when no metadata', async () => {
      selectResult = [{ id: 'org-1' }];

      await stripeService.handleSubscriptionChange({
        id: 'sub_123',
        metadata: {},
        status: 'active',
        trial_end: null,
        cancel_at: null,
        items: { data: [{ price: { id: 'price_pro' } }] },
      } as any);

      const { db } = await import('../../lib/db.js');
      expect(db.update).toHaveBeenCalled();
    });

    it('warns when org not found', async () => {
      selectResult = [];

      await stripeService.handleSubscriptionChange({
        id: 'sub_123',
        metadata: {},
        status: 'active',
        items: { data: [{ price: { id: 'price_pro' } }] },
      } as any);

      const { logger } = await import('../../lib/logger.js');
      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe('updateOrgFromSubscription', () => {
    it('downgrades to free on canceled status', async () => {
      selectResult = [{ subscriptionStatus: 'active' }];

      await stripeService.updateOrgFromSubscription('org-1', {
        status: 'canceled',
        trial_end: null,
        cancel_at: null,
        cancel_at_period_end: false,
        items: { data: [{ price: { id: 'price_pro' } }] },
      } as any);

      const { db } = await import('../../lib/db.js');
      expect(db.update).toHaveBeenCalled();
    });

    it('emits activated metric on trialing → active transition', async () => {
      selectResult = [{ subscriptionStatus: 'trialing' }];

      await stripeService.updateOrgFromSubscription('org-1', {
        status: 'active',
        trial_end: null,
        cancel_at: null,
        cancel_at_period_end: false,
        items: { data: [{ price: { id: 'price_pro' } }] },
      } as any);

      const { subscriptionEventsTotal } = await import('../../lib/metrics.js');
      expect(subscriptionEventsTotal.inc).toHaveBeenCalledWith({ event: 'activated' });
    });

    it('emits canceled metric on active → canceled transition', async () => {
      selectResult = [{ subscriptionStatus: 'active' }];

      await stripeService.updateOrgFromSubscription('org-1', {
        status: 'canceled',
        trial_end: null,
        cancel_at: null,
        cancel_at_period_end: false,
        items: { data: [{ price: { id: 'price_pro' } }] },
      } as any);

      const { subscriptionEventsTotal } = await import('../../lib/metrics.js');
      expect(subscriptionEventsTotal.inc).toHaveBeenCalledWith({ event: 'canceled' });
    });
  });

  describe('handlePaymentFailed', () => {
    it('marks subscription as past_due', async () => {
      selectResult = [{ id: 'org-1', subscriptionStatus: 'active' }];

      await stripeService.handlePaymentFailed({
        parent: { subscription_details: { subscription: 'sub_123' } },
      } as any);

      const { db } = await import('../../lib/db.js');
      expect(db.update).toHaveBeenCalled();
    });

    it('skips past_due update when subscription is already canceled', async () => {
      selectResult = [{ id: 'org-1', subscriptionStatus: 'canceled' }];

      await stripeService.handlePaymentFailed({
        parent: { subscription_details: { subscription: 'sub_123' } },
      } as any);

      const { db } = await import('../../lib/db.js');
      expect(db.update).not.toHaveBeenCalled();
    });

    it('skips when no subscription ID', async () => {
      await stripeService.handlePaymentFailed({
        parent: { subscription_details: { subscription: null } },
      } as any);

      const { db } = await import('../../lib/db.js');
      expect(db.update).not.toHaveBeenCalled();
    });

    it('warns when org not found', async () => {
      selectResult = [];

      await stripeService.handlePaymentFailed({
        parent: { subscription_details: { subscription: 'sub_123' } },
      } as any);

      const { logger } = await import('../../lib/logger.js');
      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe('cancelSubscriptionById', () => {
    it('cancels subscription', async () => {
      mockStripeSubscriptionsCancel.mockResolvedValue({});
      await stripeService.cancelSubscriptionById('sub_123');
      expect(mockStripeSubscriptionsCancel).toHaveBeenCalledWith('sub_123');
    });

    it('logs error on failure', async () => {
      mockStripeSubscriptionsCancel.mockRejectedValue(new Error('Stripe error'));
      await stripeService.cancelSubscriptionById('sub_123');
      const { logger } = await import('../../lib/logger.js');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('deleteCustomer', () => {
    it('deletes customer', async () => {
      mockStripeCustomersDel.mockResolvedValue({});
      await stripeService.deleteCustomer('cus_123');
      expect(mockStripeCustomersDel).toHaveBeenCalledWith('cus_123');
    });

    it('logs error on failure', async () => {
      mockStripeCustomersDel.mockRejectedValue(new Error('Stripe error'));
      await stripeService.deleteCustomer('cus_123');
      const { logger } = await import('../../lib/logger.js');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('getSubscription', () => {
    it('retrieves subscription', async () => {
      mockStripeSubscriptionsRetrieve.mockResolvedValue({ id: 'sub_123', status: 'active' });
      const sub = await stripeService.getSubscription('sub_123');
      expect(sub?.status).toBe('active');
    });

    it('returns null on error', async () => {
      mockStripeSubscriptionsRetrieve.mockRejectedValue(new Error('Not found'));
      const sub = await stripeService.getSubscription('sub_missing');
      expect(sub).toBeNull();
    });
  });

  describe('cancelSubscription', () => {
    it('cancels at period end by default', async () => {
      selectResult = [{ stripeSubscriptionId: 'sub_123', subscriptionStatus: 'active' }];
      mockStripeSubscriptionsUpdate.mockResolvedValue({});

      await stripeService.cancelSubscription('org-1', 'user-1');
      expect(mockStripeSubscriptionsUpdate).toHaveBeenCalledWith('sub_123', {
        cancel_at_period_end: true,
      });
    });

    it('cancels immediately when requested', async () => {
      selectResult = [{ stripeSubscriptionId: 'sub_123', subscriptionStatus: 'trialing' }];
      mockStripeSubscriptionsCancel.mockResolvedValue({});

      await stripeService.cancelSubscription('org-1', 'user-1', true);
      expect(mockStripeSubscriptionsCancel).toHaveBeenCalledWith('sub_123');
    });

    it('throws 400 when no subscription', async () => {
      selectResult = [{ stripeSubscriptionId: null, subscriptionStatus: 'none' }];
      await expect(stripeService.cancelSubscription('org-1', 'user-1'))
        .rejects.toThrow('No active subscription');
    });

    it('throws 400 when subscription already canceled', async () => {
      selectResult = [{ stripeSubscriptionId: 'sub_123', subscriptionStatus: 'canceled' }];
      await expect(stripeService.cancelSubscription('org-1', 'user-1'))
        .rejects.toThrow('Subscription is already canceled or inactive');
    });
  });

  describe('switchPlan', () => {
    it('switches subscription plan', async () => {
      selectResult = [{ stripeSubscriptionId: 'sub_123', tier: 'pro' }];
      mockStripeSubscriptionsRetrieve.mockResolvedValue({
        status: 'active',
        items: { data: [{ id: 'si_123' }] },
        metadata: {},
      });
      mockStripeSubscriptionsUpdate.mockResolvedValue({});

      await stripeService.switchPlan('org-1', 'user-1', 'team');
      expect(mockStripeSubscriptionsUpdate).toHaveBeenCalledWith('sub_123', {
        items: [
          {
            id: 'si_123',
            price: 'price_team',
          },
        ],
        proration_behavior: 'none',
        automatic_tax: { enabled: true },
        metadata: {
          targetTier: 'team',
        },
      });
    });

    it('throws 400 when no subscription', async () => {
      selectResult = [{ stripeSubscriptionId: null }];
      await expect(stripeService.switchPlan('org-1', 'user-1', 'pro'))
        .rejects.toThrow('No active subscription');
    });

    it('throws 400 when already on target tier', async () => {
      selectResult = [{ stripeSubscriptionId: 'sub_123', tier: 'pro' }];
      await expect(stripeService.switchPlan('org-1', 'user-1', 'pro'))
        .rejects.toThrow('Already on the pro plan');
    });

    it('throws 400 when subscription is in trial', async () => {
      selectResult = [{ stripeSubscriptionId: 'sub_123', tier: 'pro' }];
      mockStripeSubscriptionsRetrieve.mockResolvedValue({
        status: 'trialing',
        cancel_at_period_end: false,
        items: { data: [{ id: 'si_1', price: { id: 'price_pro' } }] },
      });
      await expect(stripeService.switchPlan('org-1', 'user-1', 'team'))
        .rejects.toThrow('Cannot switch plan during a trial. Please use the plan selection page');
    });
  });

  describe('createPortalSession', () => {
    it('creates portal session', async () => {
      selectResult = [{ stripeCustomerId: 'cus_123' }];
      mockStripePortalCreate.mockResolvedValue({ url: 'https://portal.stripe.com/session' });

      const result = await stripeService.createPortalSession('org-1', 'user-1', 'http://localhost/return');
      expect(result.url).toBe('https://portal.stripe.com/session');
    });

    it('throws 400 when no customer', async () => {
      selectResult = [{ stripeCustomerId: null }];
      await expect(stripeService.createPortalSession('org-1', 'user-1', 'http://localhost/return'))
        .rejects.toThrow('No subscription found');
    });
  });
});
