import Stripe from 'stripe';
import { eq, and, isNull } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { HTTP400Error, HTTP404Error } from '../lib/errors.js';
import { orgs, users } from '../db/schema.js';
import { stripeConfig } from '../lib/config.js';
import { logger } from '../lib/logger.js';
import { verifyOrgAdmin } from './orgService.js';
import type { SubscriptionTier } from '../types/index.js';

// Lazy-initialized Stripe client (only created when Stripe is configured)
let stripeClient: Stripe | null = null;

function getStripeClient(): Stripe {
  if (!stripeClient) {
    if (!stripeConfig.secretKey) {
      throw new HTTP400Error('Stripe is not configured');
    }
    stripeClient = new Stripe(stripeConfig.secretKey, {
      apiVersion: '2026-02-25.clover',
    });
  }
  return stripeClient;
}

// Map tier to Stripe price ID
function getPriceIdForTier(tier: SubscriptionTier): string {
  switch (tier) {
    case 'pro':
      return stripeConfig.proPriceId;
    case 'team':
      return stripeConfig.teamPriceId;
    default:
      throw new HTTP400Error(`Invalid tier for subscription: ${tier}`);
  }
}

// Map Stripe subscription status to our status
function mapStripeStatus(status: Stripe.Subscription.Status): string {
  switch (status) {
    case 'trialing':
      return 'trialing';
    case 'active':
      return 'active';
    case 'canceled':
      return 'canceled';
    case 'past_due':
      return 'past_due';
    case 'unpaid':
      return 'unpaid';
    case 'incomplete':
    case 'incomplete_expired':
    case 'paused':
    default:
      return 'none';
  }
}

// Get tier from Stripe price ID
function getTierFromPriceId(priceId: string): SubscriptionTier {
  if (priceId === stripeConfig.proPriceId) {
    return 'pro';
  }
  if (priceId === stripeConfig.teamPriceId) {
    return 'team';
  }
  return 'free';
}

export const stripeService = {
  /**
   * Get or create a Stripe customer for an organization
   */
  async getOrCreateCustomer(orgId: string, userId: string): Promise<string> {
    // 1. Quick check without lock — avoid transaction for common case
    const [orgCheck] = await db
      .select({ stripeCustomerId: orgs.stripeCustomerId, name: orgs.name })
      .from(orgs)
      .where(eq(orgs.id, orgId))
      .limit(1);

    if (!orgCheck) {
      throw new HTTP404Error('Organization not found');
    }

    if (orgCheck.stripeCustomerId) {
      return orgCheck.stripeCustomerId;
    }

    // 2. Get user email outside transaction
    const [user] = await db
      .select({ email: users.email, fullName: users.fullName })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new HTTP404Error('User not found');
    }

    // 3. Create Stripe customer OUTSIDE transaction (avoids holding DB row lock during external HTTP call)
    const customer = await getStripeClient().customers.create({
      email: user.email,
      name: user.fullName || orgCheck.name,
      metadata: {
        orgId,
        userId,
        userEmail: user.email,
        userName: user.fullName || '',
      },
    });

    // 4. Conditional UPDATE — only write if still null (prevents double-create race)
    const [updated] = await db
      .update(orgs)
      .set({ stripeCustomerId: customer.id, updatedAt: new Date() })
      .where(and(eq(orgs.id, orgId), isNull(orgs.stripeCustomerId)))
      .returning({ stripeCustomerId: orgs.stripeCustomerId });

    if (!updated) {
      // Another concurrent request already set the customer ID — clean up orphan
      try {
        await getStripeClient().customers.del(customer.id);
      } catch {
        logger.warn('Failed to delete orphan Stripe customer', { customerId: customer.id });
      }
      const [org] = await db
        .select({ stripeCustomerId: orgs.stripeCustomerId })
        .from(orgs)
        .where(eq(orgs.id, orgId))
        .limit(1);
      return org!.stripeCustomerId!;
    }

    logger.info('Created Stripe customer', { orgId, customerId: customer.id });
    return customer.id;
  },

  /**
   * Create a Stripe Checkout session for starting a trial subscription
   */
  async createCheckoutSession(
    orgId: string,
    userId: string,
    targetTier: SubscriptionTier,
    successUrl: string,
    cancelUrl: string
  ): Promise<{ sessionId: string; url: string }> {
    // Verify admin access
    await verifyOrgAdmin(orgId, userId);

    // Get or create customer
    const customerId = await stripeService.getOrCreateCustomer(orgId, userId);

    // Get price ID for target tier
    const priceId = getPriceIdForTier(targetTier);

    if (!priceId) {
      throw new HTTP400Error(`Stripe price not configured for tier: ${targetTier}`);
    }

    // Create checkout session with trial
    const session = await getStripeClient().checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: stripeConfig.trialDays,
        metadata: {
          orgId,
          targetTier,
        },
      },
      metadata: {
        orgId,
        userId,
        targetTier,
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
    });

    logger.info('Created Stripe checkout session', {
      orgId,
      sessionId: session.id,
      targetTier,
    });

    return {
      sessionId: session.id,
      url: session.url!,
    };
  },

  /**
   * Create a Stripe Customer Portal session for managing subscription
   */
  async createPortalSession(
    orgId: string,
    userId: string,
    returnUrl: string
  ): Promise<{ url: string }> {
    // Verify admin access
    await verifyOrgAdmin(orgId, userId);

    // Get customer ID
    const [org] = await db
      .select({ stripeCustomerId: orgs.stripeCustomerId })
      .from(orgs)
      .where(eq(orgs.id, orgId))
      .limit(1);

    if (!org?.stripeCustomerId) {
      throw new HTTP400Error('No subscription found for this organization');
    }

    // Create portal session
    const session = await getStripeClient().billingPortal.sessions.create({
      customer: org.stripeCustomerId,
      return_url: returnUrl,
    });

    logger.info('Created Stripe portal session', { orgId });

    return { url: session.url };
  },

  /**
   * Switch subscription plan while preserving the trial period
   */
  async switchPlan(
    orgId: string,
    userId: string,
    targetTier: SubscriptionTier
  ): Promise<void> {
    await verifyOrgAdmin(orgId, userId);

    const [org] = await db
      .select({
        stripeSubscriptionId: orgs.stripeSubscriptionId,
        tier: orgs.tier,
      })
      .from(orgs)
      .where(eq(orgs.id, orgId))
      .limit(1);

    if (!org?.stripeSubscriptionId) {
      throw new HTTP400Error('No active subscription found');
    }

    if (org.tier === targetTier) {
      throw new HTTP400Error(`Already on the ${targetTier} plan`);
    }

    const subscription = await getStripeClient().subscriptions.retrieve(org.stripeSubscriptionId);
    const newPriceId = getPriceIdForTier(targetTier);

    const subscriptionItem = subscription.items.data[0];
    if (!subscriptionItem) {
      throw new HTTP400Error('Subscription has no active items. Please contact support.');
    }

    // Update the subscription's price, keeping trial intact.
    // Do NOT update the org tier here — rely on the webhook
    // (customer.subscription.updated → handleSubscriptionChange) to update
    // the tier after Stripe confirms the change. This avoids DB/Stripe
    // inconsistency if the Stripe call succeeds but webhook hasn't fired yet,
    // or if Stripe rejects the switch.
    await getStripeClient().subscriptions.update(org.stripeSubscriptionId, {
      items: [
        {
          id: subscriptionItem.id,
          price: newPriceId,
        },
      ],
      proration_behavior: 'none',
      metadata: {
        ...subscription.metadata,
        targetTier,
      },
    });

    logger.info('Switched subscription plan (awaiting webhook confirmation)', { orgId, targetTier });
  },

  /**
   * Handle checkout session completion
   */
  async handleCheckoutComplete(session: Stripe.Checkout.Session): Promise<void> {
    const orgId = session.metadata?.orgId;
    const targetTier = session.metadata?.targetTier as SubscriptionTier;

    if (!orgId) {
      logger.warn('Checkout session missing orgId metadata', { sessionId: session.id });
      return;
    }

    // Get subscription details
    const subscriptionId = session.subscription as string;
    if (!subscriptionId) {
      logger.warn('Checkout session missing subscription', { sessionId: session.id });
      return;
    }

    const subscription = await getStripeClient().subscriptions.retrieve(subscriptionId);

    // Update org with subscription details
    await db
      .update(orgs)
      .set({
        stripeSubscriptionId: subscriptionId,
        subscriptionStatus: mapStripeStatus(subscription.status),
        tier: targetTier || getTierFromPriceId(subscription.items.data[0]?.price.id || ''),
        tierUpgradedAt: new Date(),
        trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
        subscriptionEndsAt: subscription.cancel_at
          ? new Date(subscription.cancel_at * 1000)
          : null,
        updatedAt: new Date(),
      })
      .where(eq(orgs.id, orgId));

    logger.info('Processed checkout completion', {
      orgId,
      subscriptionId,
      status: subscription.status,
      tier: targetTier,
    });
  },

  /**
   * Handle subscription updates from webhook
   */
  async handleSubscriptionChange(subscription: Stripe.Subscription): Promise<void> {
    const orgId = subscription.metadata?.orgId;

    if (!orgId) {
      // Try to find org by subscription ID
      const [org] = await db
        .select({ id: orgs.id })
        .from(orgs)
        .where(eq(orgs.stripeSubscriptionId, subscription.id))
        .limit(1);

      if (!org) {
        logger.warn('Could not find org for subscription', { subscriptionId: subscription.id });
        return;
      }

      await stripeService.updateOrgFromSubscription(org.id, subscription);
    } else {
      await stripeService.updateOrgFromSubscription(orgId, subscription);
    }
  },

  /**
   * Update org record from subscription data
   */
  async updateOrgFromSubscription(orgId: string, subscription: Stripe.Subscription): Promise<void> {
    const priceId = subscription.items.data[0]?.price.id;
    const tier = getTierFromPriceId(priceId || '');
    const status = mapStripeStatus(subscription.status);

    // If subscription is canceled or unpaid, downgrade to free
    const finalTier = ['canceled', 'unpaid', 'none'].includes(status) ? 'free' : tier;

    await db
      .update(orgs)
      .set({
        subscriptionStatus: status,
        tier: finalTier,
        trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
        subscriptionEndsAt: subscription.cancel_at
          ? new Date(subscription.cancel_at * 1000)
          : null,
        updatedAt: new Date(),
      })
      .where(eq(orgs.id, orgId));

    logger.info('Updated org subscription status', {
      orgId,
      status,
      tier: finalTier,
      trialEndsAt: subscription.trial_end,
    });
  },

  /**
   * Cancel a subscription
   */
  async cancelSubscription(
    orgId: string,
    userId: string,
    immediate: boolean = false
  ): Promise<void> {
    // Verify admin access
    await verifyOrgAdmin(orgId, userId);

    // Get subscription ID
    const [org] = await db
      .select({ stripeSubscriptionId: orgs.stripeSubscriptionId })
      .from(orgs)
      .where(eq(orgs.id, orgId))
      .limit(1);

    if (!org?.stripeSubscriptionId) {
      throw new HTTP400Error('No active subscription found');
    }

    if (immediate) {
      // Cancel immediately
      await getStripeClient().subscriptions.cancel(org.stripeSubscriptionId);
    } else {
      // Cancel at period end
      await getStripeClient().subscriptions.update(org.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });
    }

    logger.info('Canceled subscription', { orgId, immediate });
  },

  /**
   * Retrieve a subscription by ID
   */
  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription | null> {
    try {
      return await getStripeClient().subscriptions.retrieve(subscriptionId);
    } catch {
      return null;
    }
  },

  /**
   * Construct and verify webhook event
   */
  constructWebhookEvent(payload: string | Buffer, signature: string): Stripe.Event {
    return getStripeClient().webhooks.constructEvent(
      payload,
      signature,
      stripeConfig.webhookSecret
    );
  },

  /**
   * Handle invoice payment failure
   */
  async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const subscriptionId = invoice.parent?.subscription_details?.subscription as string;

    if (!subscriptionId) {
      return;
    }

    // Find org by subscription ID
    const [org] = await db
      .select({ id: orgs.id })
      .from(orgs)
      .where(eq(orgs.stripeSubscriptionId, subscriptionId))
      .limit(1);

    if (!org) {
      logger.warn('Could not find org for failed payment', { subscriptionId });
      return;
    }

    // Update status to past_due
    await db
      .update(orgs)
      .set({
        subscriptionStatus: 'past_due',
        updatedAt: new Date(),
      })
      .where(eq(orgs.id, org.id));

    logger.info('Marked subscription as past_due after payment failure', {
      orgId: org.id,
      subscriptionId,
    });
  },

  /**
   * Cancel a Stripe subscription by ID (system-level, no auth check)
   */
  async cancelSubscriptionById(subscriptionId: string): Promise<void> {
    try {
      await getStripeClient().subscriptions.cancel(subscriptionId);
      logger.info('Canceled Stripe subscription', { subscriptionId });
    } catch (err) {
      logger.error('Failed to cancel Stripe subscription', { subscriptionId, error: (err as Error).message });
    }
  },

  /**
   * Delete a Stripe customer (for GDPR account deletion)
   */
  async deleteCustomer(customerId: string): Promise<void> {
    try {
      await getStripeClient().customers.del(customerId);
      logger.info('Deleted Stripe customer', { customerId });
    } catch (err) {
      logger.error('Failed to delete Stripe customer', { customerId, error: (err as Error).message });
    }
  },

  /**
   * Check if Stripe is properly configured
   */
  isConfigured(): boolean {
    return !!(
      stripeConfig.secretKey &&
      stripeConfig.webhookSecret &&
      stripeConfig.proPriceId &&
      stripeConfig.teamPriceId
    );
  },
};
