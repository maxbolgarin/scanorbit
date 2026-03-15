import { Hono } from 'hono';
import { Webhook } from 'svix';
import { eq } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { config } from '../lib/config.js';
import { emailSubscribers } from '../db/schema.js';
import { logger } from '../lib/logger.js';
import type { Variables } from '../types/index.js';

const webhooksRoute = new Hono<{ Variables: Variables }>();

const RESEND_WEBHOOK_SECRET = config.email.resend.webhookSecret || '';

if (!RESEND_WEBHOOK_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('RESEND_WEBHOOK_SECRET is required in production');
}

/**
 * POST /webhooks/resend
 * Handles Resend webhook events (bounces, complaints, deliveries).
 * Updates email_subscribers status on bounce/complaint.
 */
webhooksRoute.post('/resend', async (c) => {
  const rawBody = await c.req.text();

  // Verify webhook signature (Resend uses Svix)
  if (RESEND_WEBHOOK_SECRET) {
    try {
      const wh = new Webhook(RESEND_WEBHOOK_SECRET);
      wh.verify(rawBody, {
        'svix-id': c.req.header('svix-id') || '',
        'svix-timestamp': c.req.header('svix-timestamp') || '',
        'svix-signature': c.req.header('svix-signature') || '',
      });
    } catch (err) {
      logger.warn('[Webhook] Resend signature verification failed', { error: (err as Error).message });
      return c.json({ error: 'Invalid signature' }, 400);
    }
  }

  let event: { type?: string; data?: { to?: string[]; email_id?: string } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return c.json({ received: true, error: 'invalid JSON' }, 400);
  }

  const eventType = event.type;
  const recipientEmail = event.data?.to?.[0];

  if (!eventType) {
    return c.json({ received: true });
  }

  switch (eventType) {
    case 'email.bounced':
      if (recipientEmail) {
        await db
          .update(emailSubscribers)
          .set({ status: 'bounced', updatedAt: new Date() })
          .where(eq(emailSubscribers.email, recipientEmail));
        logger.info('[Webhook] Bounced', { email: recipientEmail });
      }
      break;

    case 'email.complained':
      if (recipientEmail) {
        await db
          .update(emailSubscribers)
          .set({ status: 'complained', updatedAt: new Date() })
          .where(eq(emailSubscribers.email, recipientEmail));
        logger.info('[Webhook] Complained', { email: recipientEmail });
      }
      break;

    case 'email.delivered':
      // Optional: log delivery for analytics
      break;

    default:
      // Ignore unhandled event types
      break;
  }

  return c.json({ received: true });
});

export default webhooksRoute;
