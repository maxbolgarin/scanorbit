import { createHmac } from 'crypto';
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { listmonkService } from '../services/listmonkService.js';
import { sendImmediate } from '../services/dripSchedulerService.js';
import { rateLimiters } from '../middlewares/rateLimit.js';
import { logger } from '../lib/logger.js';
import type { Variables } from '../types/index.js';

const newsletterRoute = new Hono<{ Variables: Variables }>();

const subscribeSchema = z.object({
  email: z.string().email('Invalid email format'),
  name: z.string().max(64).optional(),
  consent: z.boolean().refine((val) => val === true, {
    message: 'You must consent to receive marketing emails',
  }),
});

// POST /newsletter/subscribe - Public, rate-limited
newsletterRoute.post(
  '/subscribe',
  rateLimiters.newsletter,
  zValidator('json', subscribeSchema),
  async (c) => {
    const { email, name } = c.req.valid('json');

    // Fire-and-forget: always return success to prevent email enumeration.
    // sendImmediate is chained after subscribe so the subscriber exists in Listmonk
    // before /api/tx is called (prevents 400 "Subscriber not found" race condition).
    listmonkService
      .subscribe(email, name)
      .then(() => listmonkService.updateAttribsByEmail(email, { subscribed_at: new Date().toISOString() }))
      .then(() => sendImmediate({ sequenceName: 'subscribers', email, name }))
      .catch((err) => logger.warn('listmonk: newsletter flow failed', { error: (err as Error).message }));

    return c.json({
      message: 'Thank you for subscribing! Check your inbox for confirmation.',
    });
  },
);

// GET /newsletter/unsubscribe?email=...&token=...
newsletterRoute.get('/unsubscribe', async (c) => {
  const email = c.req.query('email');
  const token = c.req.query('token');
  if (!email || !token) {
    return c.json({ message: 'Invalid unsubscribe link.' }, 400);
  }

  const secret = process.env.NEWSLETTER_UNSUBSCRIBE_SECRET ?? 'default-secret';
  const expected = createHmac('sha256', secret).update(email.toLowerCase()).digest('hex');
  if (token !== expected) {
    return c.json({ message: 'Invalid unsubscribe link.' }, 400);
  }

  listmonkService.unsubscribe(email).catch((err) =>
    logger.warn('listmonk: unsubscribe failed', { error: (err as Error).message }),
  );

  return c.json({ message: 'You have been unsubscribed.' });
});

export default newsletterRoute;
