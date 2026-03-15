import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { requireAuth } from '../middlewares/auth.js';
import { stripeService } from '../services/stripeService.js';
import { orgService } from '../services/orgService.js';
import { emailService } from '../services/emailService.js';
import { subscriberService } from '../services/subscriberService.js';
import { sendImmediate } from '../services/dripSchedulerService.js';
import { config, stripeConfig } from '../lib/config.js';
import { logger } from '../lib/logger.js';
import { HTTP400Error } from '../lib/errors.js';
import type { Variables } from '../types/index.js';
import type Stripe from 'stripe';

const stripeRoute = new Hono<{ Variables: Variables }>();

/**
 * Validate that a URL belongs to the application's frontend origin.
 * Prevents open redirect attacks via Stripe redirect URLs.
 */
function isAllowedRedirectUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const allowed = new URL(config.frontendUrl);
    return parsed.origin === allowed.origin;
  } catch {
    return false;
  }
}

// Validation schemas
const checkoutSchema = z.object({
  targetTier: z.enum(['pro', 'team']),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

const portalSchema = z.object({
  returnUrl: z.string().url().optional(),
});

/**
 * POST /stripe/checkout
 * Create a Stripe Checkout session for starting a trial subscription
 * Requires authentication and admin role
 */
stripeRoute.post(
  '/checkout',
  requireAuth,
  zValidator('json', checkoutSchema),
  async (c) => {
    const orgId = c.get('orgId');
    const userId = c.get('userId');
    const { targetTier, successUrl, cancelUrl } = c.req.valid('json');

    if (!orgId) {
      throw new HTTP400Error('Organization context required');
    }

    // Check if Stripe is configured
    if (!stripeService.isConfigured()) {
      throw new HTTP400Error('Stripe is not configured');
    }

    // Validate redirect URLs belong to our frontend origin (prevent open redirect)
    if (successUrl && !isAllowedRedirectUrl(successUrl)) {
      throw new HTTP400Error('Invalid successUrl: must be on the application domain');
    }
    if (cancelUrl && !isAllowedRedirectUrl(cancelUrl)) {
      throw new HTTP400Error('Invalid cancelUrl: must be on the application domain');
    }

    // Default URLs based on frontend URL
    const defaultSuccessUrl = `${config.frontendUrl}/settings?tab=subscription&success=true`;
    const defaultCancelUrl = `${config.frontendUrl}/settings?tab=subscription&canceled=true`;

    const session = await stripeService.createCheckoutSession(
      orgId,
      userId,
      targetTier,
      successUrl || defaultSuccessUrl,
      cancelUrl || defaultCancelUrl
    );

    return c.json({ data: session });
  }
);

/**
 * POST /stripe/switch-plan
 * Switch subscription plan while preserving the trial period
 * Requires authentication and admin role
 */
const switchPlanSchema = z.object({
  targetTier: z.enum(['pro', 'team']),
});

stripeRoute.post(
  '/switch-plan',
  requireAuth,
  zValidator('json', switchPlanSchema),
  async (c) => {
    const orgId = c.get('orgId');
    const userId = c.get('userId');
    const { targetTier } = c.req.valid('json');

    if (!orgId) {
      throw new HTTP400Error('Organization context required');
    }

    if (!stripeService.isConfigured()) {
      throw new HTTP400Error('Stripe is not configured');
    }

    await stripeService.switchPlan(orgId, userId, targetTier);
    return c.json({ data: { switched: true, targetTier } });
  }
);

/**
 * POST /stripe/portal
 * Create a Stripe Customer Portal session for managing subscription
 * Requires authentication and admin role
 */
stripeRoute.post(
  '/portal',
  requireAuth,
  zValidator('json', portalSchema),
  async (c) => {
    const orgId = c.get('orgId');
    const userId = c.get('userId');
    const { returnUrl } = c.req.valid('json');

    if (!orgId) {
      throw new HTTP400Error('Organization context required');
    }

    // Check if Stripe is configured
    if (!stripeService.isConfigured()) {
      throw new HTTP400Error('Stripe is not configured');
    }

    // Validate redirect URL belongs to our frontend origin (prevent open redirect)
    if (returnUrl && !isAllowedRedirectUrl(returnUrl)) {
      throw new HTTP400Error('Invalid returnUrl: must be on the application domain');
    }

    const defaultReturnUrl = `${config.frontendUrl}/settings?tab=subscription`;

    const session = await stripeService.createPortalSession(
      orgId,
      userId,
      returnUrl || defaultReturnUrl
    );

    return c.json({ data: session });
  }
);

/**
 * POST /stripe/cancel
 * Cancel the current subscription
 * Requires authentication and admin role
 */
const cancelSchema = z.object({
  immediate: z.boolean().optional().default(false),
});

stripeRoute.post(
  '/cancel',
  requireAuth,
  zValidator('json', cancelSchema),
  async (c) => {
    const orgId = c.get('orgId');
    const userId = c.get('userId');
    const { immediate } = c.req.valid('json');

    if (!orgId) {
      throw new HTTP400Error('Organization context required');
    }

    if (!stripeService.isConfigured()) {
      throw new HTTP400Error('Stripe is not configured');
    }

    await stripeService.cancelSubscription(orgId, userId, immediate);
    return c.json({ data: { canceled: true, immediate } });
  }
);

/**
 * POST /stripe/webhook
 * Handle Stripe webhook events
 * No authentication - verified by Stripe signature
 */
stripeRoute.post('/webhook', async (c) => {
  // Check if Stripe is configured
  if (!stripeService.isConfigured()) {
    logger.warn('Stripe webhook received but Stripe is not configured');
    // Return 503 so Stripe retries — returning 200 would mark the event as delivered permanently
    return c.json({ error: 'Stripe not configured' }, 503);
  }

  // Get raw body for signature verification
  const signature = c.req.header('stripe-signature');

  if (!signature) {
    logger.warn('Webhook missing stripe-signature header');
    return c.json({ error: 'Missing signature' }, 400);
  }

  let event: Stripe.Event;

  try {
    const rawBody = Buffer.from(await c.req.arrayBuffer());
    event = stripeService.constructWebhookEvent(rawBody, signature);
    logger.info('Stripe webhook received', { type: event.type, id: event.id });
  } catch (err) {
    const error = err as Error;
    logger.warn('Webhook signature verification failed', { error: error.message });
    return c.json({ error: 'Invalid signature' }, 400);
  }

  // Handle the event
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await stripeService.handleCheckoutComplete(session);

        // Move subscriber to trial-new list in Listmonk
        try {
          const orgId = session.metadata?.orgId;
          if (orgId) {
            const admin = await orgService.getOrgAdminEmail(orgId);
            if (admin) {
              subscriberService.onTrialStart(admin.email)
                .then(() => subscriberService.updateAttribsByEmail(admin.email, {
                  trial_started_at: new Date().toISOString(),
                  tier: 'trial',
                  plan: session.metadata?.targetTier || 'pro',
                }))
                .then(() => sendImmediate({ sequenceName: 'trial-new', email: admin.email, name: admin.name }))
                .catch((err) => logger.warn('subscriber: failed onTrialStart/sendImmediate', { error: (err as Error).message }));
            }
          }
        } catch (subscriberErr) {
          logger.warn('Failed to update Listmonk on checkout', {
            error: (subscriberErr as Error).message,
          });
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await stripeService.handleSubscriptionChange(subscription);

        // Update Listmonk lists based on subscription transitions
        try {
          const orgId = subscription.metadata?.orgId;
          if (orgId) {
            const admin = await orgService.getOrgAdminEmail(orgId);
            if (admin) {
              const priceId = subscription.items.data[0]?.price.id || '';
              const tier = priceId === stripeConfig.teamPriceId ? 'team' as const : 'pro' as const;

              if (event.type === 'customer.subscription.updated') {
                const prev = (event.data as Stripe.Event.Data & { previous_attributes?: Partial<Stripe.Subscription> }).previous_attributes;
                // Trial → Active (payment confirmed)
                if (prev?.status === 'trialing' && subscription.status === 'active') {
                  subscriberService.onPayment(admin.email, tier)
                    .then(() => subscriberService.updateAttribsByEmail(admin.email, {
                      paid_at: new Date().toISOString(),
                      tier: `paid-${tier}`,
                      plan: tier,
                    }))
                    .then(() => sendImmediate({ sequenceName: tier === 'team' ? 'paid-team' : 'paid-pro', email: admin.email, name: admin.name }))
                    .catch((err) => logger.warn('subscriber: failed onPayment/sendImmediate', { error: (err as Error).message }));
                }
                // Plan change (Pro ↔ Team)
                if (prev?.items && subscription.status === 'active') {
                  const prevPriceId = prev.items.data?.[0]?.price?.id;
                  if (prevPriceId && prevPriceId !== priceId) {
                    const prevTier = prevPriceId === stripeConfig.teamPriceId ? 'team' as const : 'pro' as const;
                    subscriberService.onPlanChange(admin.email, prevTier, tier)
                      .then(() => subscriberService.updateAttribsByEmail(admin.email, {
                        tier: `paid-${tier}`,
                        plan: tier,
                        paid_at: new Date().toISOString(),
                      }))
                      .then(() => sendImmediate({ sequenceName: tier === 'team' ? 'paid-team' : 'paid-pro', email: admin.email, name: admin.name }))
                      .catch((err) => logger.warn('subscriber: failed onPlanChange', { error: (err as Error).message }));
                  }
                }
                // Subscription canceled (at period end or immediately)
                if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
                  const isTrialCancel = prev?.status === 'trialing';
                  subscriberService.onChurn(admin.email, isTrialCancel).catch((err) => logger.warn('subscriber: failed onChurn', { error: (err as Error).message }));
                }
              }

              if (event.type === 'customer.subscription.deleted') {
                // Check if trial was still running at deletion time (not the broad 14-day heuristic).
                // subscription.trial_end is in the future if trial was still active when deleted.
                const isTrialCancel = subscription.status === 'canceled' &&
                  !!subscription.trial_end &&
                  subscription.trial_end > Math.floor(Date.now() / 1000);
                subscriberService.onChurn(admin.email, isTrialCancel).catch((err) => logger.warn('subscriber: failed onChurn', { error: (err as Error).message }));
              }
            }
          }
        } catch (subscriberErr) {
          logger.warn('Failed to update Listmonk on subscription change', {
            error: (subscriberErr as Error).message,
          });
        }
        break;
      }

      case 'customer.subscription.trial_will_end': {
        const subscription = event.data.object as Stripe.Subscription;

        // Only send if still in trial (skip if already paid/active)
        if (subscription.status !== 'trialing') {
          logger.info('Skipping trial-ending email: subscription is already', {
            status: subscription.status,
            subscriptionId: subscription.id,
          });
          break;
        }

        logger.info('Trial will end soon', {
          subscriptionId: subscription.id,
          trialEnd: subscription.trial_end,
        });

        // Send trial ending email to org admin
        try {
          const orgId = subscription.metadata?.orgId;
          if (orgId) {
            const admin = await orgService.getOrgAdminEmail(orgId);
            if (admin) {
              const trialEndsAt = subscription.trial_end
                ? new Date(subscription.trial_end * 1000)
                : new Date();
              const tier = subscription.items.data[0]?.price?.nickname || 'Pro';
              await emailService.sendTrialEndingEmail(
                admin.email,
                trialEndsAt,
                tier,
                admin.name || undefined
              );
            }
          }
        } catch (emailErr) {
          logger.warn('Failed to send trial ending email', {
            error: (emailErr as Error).message,
          });
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await stripeService.handlePaymentFailed(invoice);

        // Send payment failed email to org admin
        try {
          const parentSub = invoice.parent?.subscription_details?.subscription;
          const subscriptionId = typeof parentSub === 'string' ? parentSub : (parentSub as { id?: string } | null | undefined)?.id;
          if (subscriptionId) {
            const subscription = await stripeService.getSubscription(subscriptionId);
            const orgId = subscription?.metadata?.orgId;
            if (orgId) {
              const admin = await orgService.getOrgAdminEmail(orgId);
              if (admin) {
                const tier = subscription?.items?.data[0]?.price?.nickname || 'Pro';
                await emailService.sendPaymentFailedEmail(
                  admin.email,
                  tier,
                  admin.name || undefined
                );
              }
            }
          }
        } catch (emailErr) {
          logger.warn('Failed to send payment failed email', {
            error: (emailErr as Error).message,
          });
        }
        break;
      }

      default:
        logger.debug('Unhandled webhook event type', { type: event.type });
    }
  } catch (err) {
    const error = err as Error;
    logger.error('Error processing webhook event', {
      type: event.type,
      error: error.message,
      stack: error.stack,
    });
    // Return 500 to trigger Stripe retry for transient failures
    // This ensures we don't miss critical subscription events
    return c.json({ error: 'Webhook processing failed' }, 500);
  }

  return c.json({ received: true });
});

export default stripeRoute;
