import { Hono } from 'hono';
import { listmonkConfig } from '../lib/config.js';
import { logger } from '../lib/logger.js';
import { timingSafeEqual } from 'crypto';
import type { Variables } from '../types/index.js';

const webhooksRoute = new Hono<{ Variables: Variables }>();

const BOUNCE_EVENT_TYPES = new Set(['email_dropped', 'email_mailbox_not_found']);

// Webhook secret for Scaleway bounce webhook authentication
// Set SCALEWAY_WEBHOOK_SECRET env var and configure the X-Webhook-Secret header in Scaleway
const WEBHOOK_SECRET = process.env.SCALEWAY_WEBHOOK_SECRET || '';

if (!WEBHOOK_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('SCALEWAY_WEBHOOK_SECRET is required in production');
}

/**
 * POST /webhooks/scaleway-bounce
 * Bridge between Scaleway TEM bounce webhooks and Listmonk's bounce API.
 * Receives Scaleway events, filters for bounces, forwards to Listmonk.
 * Authenticated via shared secret query parameter (configure in Scaleway webhook URL).
 */
webhooksRoute.post('/scaleway-bounce', async (c) => {
  // Verify shared secret via header (not query param to avoid logging secrets in URLs)
  if (WEBHOOK_SECRET) {
    const secret = c.req.header('x-webhook-secret') || '';
    if (!secret || !safeCompare(secret, WEBHOOK_SECRET)) {
      logger.warn('[Bounce] Unauthorized webhook request');
      return c.json({ error: 'Unauthorized' }, 401);
    }
  }

  let body: { type?: string; payload?: Record<string, unknown> };

  try {
    body = await c.req.json();
  } catch {
    return c.json({ received: true, error: 'invalid JSON' }, 400);
  }

  const eventType = body.type;

  if (!eventType || !BOUNCE_EVENT_TYPES.has(eventType)) {
    // Ignored event type — return 200 so Scaleway doesn't retry
    return c.json({ received: true, ignored: true });
  }

  const email = body.payload?.rcpt_to as string | undefined;
  if (!email) {
    logger.warn('[Bounce] Scaleway bounce event missing rcpt_to', { eventType });
    return c.json({ received: true, error: 'missing rcpt_to' });
  }

  logger.info('[Bounce] Forwarding bounce to Listmonk', { eventType, email });

  // Forward to Listmonk bounce webhook (fire-and-forget, always return 200)
  try {
    const auth = 'Basic ' + Buffer.from(
      `${listmonkConfig.apiUser}:${listmonkConfig.apiPassword}`
    ).toString('base64');

    const res = await fetch(`${listmonkConfig.apiUrl}/api/webhooks/bounce`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': auth,
      },
      body: JSON.stringify({
        source: 'api',
        type: 'hard',
        email,
        meta: JSON.stringify(body),
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      const text = await res.text();
      logger.error('[Bounce] Listmonk bounce API error', { status: res.status, body: text });
    }
  } catch (err) {
    logger.error('[Bounce] Failed to forward bounce to Listmonk', err as Error);
  }

  return c.json({ received: true });
});

/**
 * Constant-time string comparison to prevent timing attacks on webhook secret.
 * Always runs timingSafeEqual to avoid leaking the secret's length via timing.
 */
function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  // Pad to equal length so timingSafeEqual always runs
  const maxLen = Math.max(bufA.length, bufB.length);
  const paddedA = Buffer.alloc(maxLen);
  const paddedB = Buffer.alloc(maxLen);
  bufA.copy(paddedA);
  bufB.copy(paddedB);
  return timingSafeEqual(paddedA, paddedB) && bufA.length === bufB.length;
}

export default webhooksRoute;
