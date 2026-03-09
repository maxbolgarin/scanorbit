import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { listmonkService } from '../services/listmonkService.js';
import { sendImmediate } from '../services/dripSchedulerService.js';
import { rateLimiters } from '../middlewares/rateLimit.js';
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

    // Fire-and-forget: always return success to prevent email enumeration
    listmonkService.subscribe(email, name).catch(() => {});
    sendImmediate({ sequenceName: 'subscribers', email, name }).catch(() => {});

    return c.json({
      message: 'Thank you for subscribing! Check your inbox for confirmation.',
    });
  },
);

export default newsletterRoute;
