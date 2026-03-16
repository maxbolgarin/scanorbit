import Stripe from 'stripe';
import { eq, and, isNull } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { HTTP400Error, HTTP404Error } from '../lib/errors.js';
import { orgs, users } from '../db/schema.js';
import { stripeConfig } from '../lib/config.js';
import { logger } from '../lib/logger.js';
import { subscriptionEventsTotal, planSwitchesTotal } from '../lib/metrics.js';
import { redis } from '../lib/redis.js';
import { verifyOrgAdmin } from './orgService.js';
import { SEAT_BILLING } from '../types/index.js';
import type { SubscriptionTier } from '../types/index.js';

/** TTL for webhook event deduplication (24 hours) */
const WEBHOOK_DEDUP_TTL = 86400;

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
    case 'paused': // Paused subscriptions retain their tier (intentional pause, not cancellation)
      return 'active';
    case 'canceled':
      return 'canceled';
    case 'past_due':
      return 'past_due';
    case 'unpaid':
      return 'unpaid';
    case 'incomplete':
    case 'incomplete_expired':
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

// Validate and extract tier from metadata (protects against invalid values)
function validateTierFromMetadata(rawTier: string | undefined): SubscriptionTier {
  if (rawTier === 'pro' || rawTier === 'team') {
    return rawTier;
  }
  return 'free';
}

// Derive tier from subscription: price ID is authoritative, metadata is fallback
function deriveTierFromSubscription(subscription: Stripe.Subscription): SubscriptionTier {
  const priceId = subscription.items.data[0]?.price?.id || '';
  const fromPrice = getTierFromPriceId(priceId);
  if (fromPrice !== 'free') return fromPrice;

  // Fallback to metadata — log warning since metadata is mutable and less trustworthy
  const metadataTier = validateTierFromMetadata(subscription.metadata?.targetTier);
  if (metadataTier !== 'free') {
    logger.warn('Derived tier from metadata fallback (price ID not recognized)', {
      subscriptionId: subscription.id,
      priceId,
      metadataTier,
    });
  }
  return metadataTier;
}

/** Extract subscription ID from session.subscription (may be string or expanded object) */
function extractSubscriptionId(subscription: string | Stripe.Subscription | null | undefined): string | null {
  if (!subscription) return null;
  if (typeof subscription === 'string') return subscription;
  return subscription.id || null;
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
      // Retry deletion up to 2 times to reduce orphan leakage
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          await getStripeClient().customers.del(customer.id);
          break;
        } catch (delErr) {
          logger.warn('Failed to delete orphan Stripe customer', {
            customerId: customer.id,
            attempt,
            error: (delErr as Error).message,
          });
        }
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

    // Prevent creating checkout when org already has an active/trialing subscription
    const [existingOrg] = await db
      .select({ subscriptionStatus: orgs.subscriptionStatus })
      .from(orgs)
      .where(eq(orgs.id, orgId))
      .limit(1);

    if (existingOrg && ['active', 'trialing'].includes(existingOrg.subscriptionStatus || '')) {
      throw new HTTP400Error('Organization already has an active subscription. Use the billing portal to change plans.');
    }

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

    if (!session.url) {
      throw new HTTP400Error('Stripe returned no checkout URL');
    }

    return {
      sessionId: session.id,
      url: session.url,
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

    if (subscription.cancel_at_period_end || subscription.status === 'canceled') {
      throw new HTTP400Error('Cannot switch plan on a canceled subscription. Please resubscribe.');
    }

    // Only allow switches on active or trialing subscriptions
    if (subscription.status !== 'active' && subscription.status !== 'trialing') {
      throw new HTTP400Error(`Cannot switch plan while subscription is ${subscription.status}. Please resolve billing issues first.`);
    }

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

    subscriptionEventsTotal.inc({ event: 'plan_switched' });
    planSwitchesTotal.inc({ from_tier: org.tier, to_tier: targetTier });

    logger.info('Switched subscription plan (awaiting webhook confirmation)', { orgId, targetTier });
  },

  /**
   * Handle checkout session completion
   */
  async handleCheckoutComplete(session: Stripe.Checkout.Session): Promise<void> {
    const orgId = session.metadata?.orgId;

    if (!orgId) {
      logger.warn('Checkout session missing orgId metadata', { sessionId: session.id });
      return;
    }

    // Extract subscription ID safely (may be string or expanded object)
    const subscriptionId = extractSubscriptionId(session.subscription);
    if (!subscriptionId) {
      logger.warn('Checkout session missing subscription', { sessionId: session.id });
      return;
    }

    // Check for existing subscription on this org to prevent orphaned billing
    const [existingOrg] = await db
      .select({ stripeSubscriptionId: orgs.stripeSubscriptionId })
      .from(orgs)
      .where(eq(orgs.id, orgId))
      .limit(1);

    if (existingOrg?.stripeSubscriptionId && existingOrg.stripeSubscriptionId !== subscriptionId) {
      logger.error('Org already has a different subscription — canceling old one to prevent orphan billing', {
        orgId,
        oldSubscriptionId: existingOrg.stripeSubscriptionId,
        newSubscriptionId: subscriptionId,
      });
      try {
        await getStripeClient().subscriptions.cancel(existingOrg.stripeSubscriptionId);
      } catch (cancelErr) {
        logger.error('Failed to cancel old subscription during checkout', {
          subscriptionId: existingOrg.stripeSubscriptionId,
          error: (cancelErr as Error).message,
        });
      }
    }

    const subscription = await getStripeClient().subscriptions.retrieve(subscriptionId);
    const tier = deriveTierFromSubscription(subscription);

    // Update org with subscription details
    const subscriptionEndsAt = subscription.cancel_at
      ? new Date(subscription.cancel_at * 1000)
      : subscription.cancel_at_period_end
        ? new Date(((subscription as Stripe.Subscription & { current_period_end?: number }).current_period_end || subscription.trial_end || 0) * 1000)
        : null;

    await db
      .update(orgs)
      .set({
        stripeSubscriptionId: subscriptionId,
        subscriptionStatus: mapStripeStatus(subscription.status),
        tier,
        tierUpgradedAt: new Date(),
        trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
        subscriptionEndsAt,
        updatedAt: new Date(),
      })
      .where(eq(orgs.id, orgId));

    subscriptionEventsTotal.inc({ event: 'trial_started' });

    logger.info('Processed checkout completion', {
      orgId,
      subscriptionId,
      status: subscription.status,
      tier,
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
    const tier = deriveTierFromSubscription(subscription);
    const status = mapStripeStatus(subscription.status);

    // If subscription is canceled or unpaid, downgrade to free
    const finalTier = ['canceled', 'unpaid', 'none'].includes(status) ? 'free' : tier;

    // Determine subscription end date:
    // - cancel_at is set when canceling at a future date (including cancel_at_period_end)
    // - Fallback to current_period_end when cancel_at_period_end is set but cancel_at is missing
    const subscriptionEndsAt = subscription.cancel_at
      ? new Date(subscription.cancel_at * 1000)
      : subscription.cancel_at_period_end
        ? new Date(((subscription as Stripe.Subscription & { current_period_end?: number }).current_period_end || subscription.trial_end || 0) * 1000)
        : null;

    // Use conditional update to detect previous status and prevent lost updates
    // from concurrent webhooks. The RETURNING clause gives us the old status.
    const [updated] = await db
      .update(orgs)
      .set({
        subscriptionStatus: status,
        tier: finalTier,
        trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
        subscriptionEndsAt,
        updatedAt: new Date(),
      })
      .where(eq(orgs.id, orgId))
      .returning({ previousStatus: orgs.subscriptionStatus });

    const previousStatus = updated?.previousStatus || 'none';

    // Emit subscription lifecycle events on status transitions
    if (previousStatus === 'trialing' && status === 'active') {
      subscriptionEventsTotal.inc({ event: 'activated' });
    }
    if (status === 'canceled' && previousStatus !== 'canceled') {
      subscriptionEventsTotal.inc({ event: 'canceled' });
    }

    logger.info('Updated org subscription status', {
      orgId,
      previousStatus,
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

    // Get subscription ID and status
    const [org] = await db
      .select({
        stripeSubscriptionId: orgs.stripeSubscriptionId,
        subscriptionStatus: orgs.subscriptionStatus,
      })
      .from(orgs)
      .where(eq(orgs.id, orgId))
      .limit(1);

    if (!org?.stripeSubscriptionId) {
      throw new HTTP400Error('No active subscription found');
    }

    // Only allow cancellation of active or trialing subscriptions
    if (!['active', 'trialing', 'past_due'].includes(org.subscriptionStatus || '')) {
      throw new HTTP400Error('Subscription is already canceled or inactive');
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
    } catch (err) {
      const stripeErr = err as { statusCode?: number; message?: string };
      if (stripeErr.statusCode === 404) {
        return null; // Subscription not found — expected case
      }
      // Log unexpected errors (network, auth, rate limit) but still return null
      // to avoid crashing webhook handlers
      logger.warn('Unexpected error retrieving Stripe subscription', {
        subscriptionId,
        statusCode: stripeErr.statusCode,
        error: stripeErr.message,
      });
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
    const parentSub = invoice.parent?.subscription_details?.subscription;
    const subscriptionId = typeof parentSub === 'string'
      ? parentSub
      : (parentSub as { id?: string } | null | undefined)?.id;

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

    subscriptionEventsTotal.inc({ event: 'payment_failed' });

    logger.info('Marked subscription as past_due after payment failure', {
      orgId: org.id,
      subscriptionId,
    });
  },

  /**
   * Sync subscription state from Stripe API to database.
   * Fallback for when webhooks fail to deliver.
   */
  async syncSubscription(
    orgId: string,
    userId: string
  ): Promise<{ synced: boolean; tier: SubscriptionTier }> {
    await verifyOrgAdmin(orgId, userId);

    const [org] = await db
      .select({
        stripeCustomerId: orgs.stripeCustomerId,
        stripeSubscriptionId: orgs.stripeSubscriptionId,
        tier: orgs.tier,
      })
      .from(orgs)
      .where(eq(orgs.id, orgId))
      .limit(1);

    if (!org?.stripeCustomerId) {
      return { synced: false, tier: 'free' };
    }

    let subscription: Stripe.Subscription | null = null;

    // Try stored subscription ID first
    if (org.stripeSubscriptionId) {
      try {
        subscription = await getStripeClient().subscriptions.retrieve(org.stripeSubscriptionId);
      } catch {
        // Subscription may have been deleted, fall through to list
      }
    }

    // Fallback: list customer's subscriptions (covers the case where
    // stripeSubscriptionId hasn't been stored yet — the core bug)
    // Try active/trialing first, then fall back to any status
    if (!subscription) {
      let subscriptions = await getStripeClient().subscriptions.list({
        customer: org.stripeCustomerId,
        status: 'active',
        limit: 1,
      });
      if (subscriptions.data.length === 0) {
        subscriptions = await getStripeClient().subscriptions.list({
          customer: org.stripeCustomerId,
          status: 'trialing',
          limit: 1,
        });
      }
      if (subscriptions.data.length === 0) {
        subscriptions = await getStripeClient().subscriptions.list({
          customer: org.stripeCustomerId,
          limit: 1,
        });
      }
      subscription = subscriptions.data[0] || null;
    }

    if (!subscription) {
      return { synced: false, tier: 'free' };
    }

    // Derive tier with metadata fallback
    const tier = deriveTierFromSubscription(subscription);
    const status = mapStripeStatus(subscription.status);
    const finalTier = ['canceled', 'unpaid', 'none'].includes(status) ? 'free' : tier;

    const subscriptionEndsAt = subscription.cancel_at
      ? new Date(subscription.cancel_at * 1000)
      : subscription.cancel_at_period_end
        ? new Date(((subscription as Stripe.Subscription & { current_period_end?: number }).current_period_end || subscription.trial_end || 0) * 1000)
        : null;

    await db
      .update(orgs)
      .set({
        stripeSubscriptionId: subscription.id,
        subscriptionStatus: status,
        tier: finalTier,
        ...(finalTier !== 'free' && org.tier === 'free' ? { tierUpgradedAt: new Date() } : {}),
        trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
        subscriptionEndsAt,
        updatedAt: new Date(),
      })
      .where(eq(orgs.id, orgId));

    logger.info('Synced subscription from Stripe', { orgId, tier: finalTier, status });
    return { synced: true, tier: finalTier };
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
   * Get seat subscription item info for an org
   */
  async getSeatItemInfo(orgId: string): Promise<{ itemId: string | null; quantity: number }> {
    const [org] = await db
      .select({ stripeSubscriptionId: orgs.stripeSubscriptionId })
      .from(orgs)
      .where(eq(orgs.id, orgId))
      .limit(1);

    if (!org?.stripeSubscriptionId) {
      return { itemId: null, quantity: 0 };
    }

    try {
      const subscription = await getStripeClient().subscriptions.retrieve(org.stripeSubscriptionId);
      const seatItem = subscription.items.data.find(
        (item) => item.price?.id === stripeConfig.seatPriceId
      );
      return {
        itemId: seatItem?.id ?? null,
        quantity: seatItem?.quantity ?? 0,
      };
    } catch {
      return { itemId: null, quantity: 0 };
    }
  },

  /**
   * Update paid seat count on Stripe subscription (idempotent — sets absolute quantity)
   * Best-effort: logs errors but does not throw
   */
  async updateSeatQuantity(orgId: string, newPaidSeats: number): Promise<void> {
    if (!stripeConfig.seatPriceId) {
      logger.warn('STRIPE_SEAT_PRICE_ID not configured, skipping seat billing update', { orgId });
      return;
    }

    try {
      const [org] = await db
        .select({ stripeSubscriptionId: orgs.stripeSubscriptionId })
        .from(orgs)
        .where(eq(orgs.id, orgId))
        .limit(1);

      if (!org?.stripeSubscriptionId) {
        logger.warn('No subscription found for seat update', { orgId });
        return;
      }

      // Inline subscription retrieval to avoid redundant DB query via getSeatItemInfo
      const subscription = await getStripeClient().subscriptions.retrieve(org.stripeSubscriptionId);
      const seatItem = subscription.items.data.find(
        (item) => item.price?.id === stripeConfig.seatPriceId
      );
      const itemId = seatItem?.id ?? null;

      if (newPaidSeats > 0 && !itemId) {
        // Add new seat item to subscription
        await getStripeClient().subscriptionItems.create({
          subscription: org.stripeSubscriptionId,
          price: stripeConfig.seatPriceId,
          quantity: newPaidSeats,
          proration_behavior: 'create_prorations',
        });
        logger.info('Added seat item to subscription', { orgId, quantity: newPaidSeats });
      } else if (newPaidSeats > 0 && itemId) {
        // Update existing seat item quantity
        await getStripeClient().subscriptionItems.update(itemId, {
          quantity: newPaidSeats,
          proration_behavior: 'create_prorations',
        });
        logger.info('Updated seat quantity', { orgId, quantity: newPaidSeats });
      } else if (newPaidSeats <= 0 && itemId) {
        // Remove seat item
        await getStripeClient().subscriptionItems.del(itemId, {
          proration_behavior: 'create_prorations',
        });
        logger.info('Removed seat item from subscription', { orgId });
      }
    } catch (err) {
      logger.error('Failed to update Stripe seat quantity', {
        orgId,
        newPaidSeats,
        error: (err as Error).message,
      });
    }
  },

  /**
   * Get billing preview for adding a new member
   */
  getSeatBillingPreview(totalMemberCount: number): {
    willAddPaidSeat: boolean;
    currentPaidSeats: number;
    newPaidSeats: number;
    seatPriceMonthly: number;
    estimatedSeatCost: number;
  } {
    const currentPaidSeats = Math.max(0, totalMemberCount - SEAT_BILLING.INCLUDED_SEATS);
    const newPaidSeats = Math.max(0, totalMemberCount + 1 - SEAT_BILLING.INCLUDED_SEATS);
    return {
      willAddPaidSeat: newPaidSeats > currentPaidSeats,
      currentPaidSeats,
      newPaidSeats,
      seatPriceMonthly: SEAT_BILLING.SEAT_PRICE_MONTHLY,
      // Only show additional seat cost — base plan price varies and may be $0 during trial
      estimatedSeatCost: newPaidSeats * SEAT_BILLING.SEAT_PRICE_MONTHLY,
    };
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

  /**
   * Deduplicate webhook events. Returns true if the event has NOT been processed yet.
   * Uses Redis SET NX with TTL to ensure at-most-once processing.
   */
  async isNewWebhookEvent(eventId: string): Promise<boolean> {
    try {
      const result = await redis.set(`stripe:event:${eventId}`, '1', 'EX', WEBHOOK_DEDUP_TTL, 'NX');
      return result === 'OK';
    } catch (err) {
      // If Redis is unavailable, allow processing to avoid missing events
      logger.warn('Redis unavailable for webhook dedup, allowing event', {
        eventId,
        error: (err as Error).message,
      });
      return true;
    }
  },
};
