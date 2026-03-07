import { Hono } from 'hono';
import { listmonkConfig } from '../lib/config.js';
import { logger } from '../lib/logger.js';
import type { Variables } from '../types/index.js';

const webhooksRoute = new Hono<{ Variables: Variables }>();

const BOUNCE_EVENT_TYPES = new Set(['email_dropped', 'email_mailbox_not_found']);

/**
 * POST /webhooks/scaleway-bounce
 * Bridge between Scaleway TEM bounce webhooks and Listmonk's bounce API.
 * Receives Scaleway events, filters for bounces, forwards to Listmonk.
 * No auth — Scaleway webhooks are unauthenticated (like Stripe webhooks).
 */
webhooksRoute.post('/scaleway-bounce', async (c) => {
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

export default webhooksRoute;
