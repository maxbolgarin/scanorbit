import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { requireAuth } from '../middlewares/auth.js';
import { stripeService } from '../services/stripeService.js';
import { config } from '../lib/config.js';
import { logger } from '../lib/logger.js';
import { HTTP400Error } from '../lib/errors.js';
import type { Variables } from '../types/index.js';
import type Stripe from 'stripe';

const stripeRoute = new Hono<{ Variables: Variables }>();

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

    // Default URLs based on frontend URL
    const defaultSuccessUrl = `${config.frontendUrl}/settings/subscription?success=true`;
    const defaultCancelUrl = `${config.frontendUrl}/settings/subscription?canceled=true`;

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

    const defaultReturnUrl = `${config.frontendUrl}/settings/subscription`;

    const session = await stripeService.createPortalSession(
      orgId,
      userId,
      returnUrl || defaultReturnUrl
    );

    return c.json({ data: session });
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
    return c.json({ received: true });
  }

  // Get raw body for signature verification
  const signature = c.req.header('stripe-signature');

  if (!signature) {
    logger.warn('Webhook missing stripe-signature header');
    return c.json({ error: 'Missing signature' }, 400);
  }

  let event: Stripe.Event;

  try {
    const rawBody = await c.req.text();
    event = stripeService.constructWebhookEvent(rawBody, signature);
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
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await stripeService.handleSubscriptionChange(subscription);
        break;
      }

      case 'customer.subscription.trial_will_end': {
        const subscription = event.data.object as Stripe.Subscription;
        // Log trial ending soon - could send email notification here
        logger.info('Trial will end soon', {
          subscriptionId: subscription.id,
          trialEnd: subscription.trial_end,
        });
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await stripeService.handlePaymentFailed(invoice);
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
    });
    // Return 200 to prevent Stripe from retrying
    // We log the error for debugging
  }

  return c.json({ received: true });
});

export default stripeRoute;
