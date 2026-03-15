import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { Variables } from '../../types/index.js';

const { mockEval, mockTtl } = vi.hoisted(() => ({
  mockEval: vi.fn().mockResolvedValue(1),
  mockTtl: vi.fn().mockResolvedValue(600),
}));

vi.mock('../../lib/redis.js', () => ({
  redis: { eval: mockEval, ttl: mockTtl, on: vi.fn() },
}));

vi.mock('../../lib/ip.js', () => ({
  getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
}));

const { mockSubscriberService } = vi.hoisted(() => ({
  mockSubscriberService: {
    subscribe: vi.fn().mockResolvedValue(undefined),
    unsubscribe: vi.fn().mockResolvedValue(undefined),
    updateAttribsByEmail: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('../../services/subscriberService.js', () => ({
  subscriberService: mockSubscriberService,
}));

vi.mock('../../services/dripSchedulerService.js', () => ({
  sendImmediate: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../lib/metrics.js', () => ({
  errorsTotal: { inc: vi.fn() },
}));

import newsletterRoute from '../../routes/newsletter.js';
import { errorHandler } from '../../middlewares/errorHandler.js';

describe('Newsletter Routes', () => {
  let app: Hono<{ Variables: Variables }>;

  beforeEach(() => {
    app = new Hono<{ Variables: Variables }>();
    app.route('/newsletter', newsletterRoute);
    app.onError(errorHandler);
    vi.clearAllMocks();
    mockEval.mockResolvedValue(1);
    mockTtl.mockResolvedValue(600);
  });

  describe('POST /newsletter/subscribe', () => {
    it('subscribes with valid email and consent', async () => {
      const res = await app.request('/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'user@example.com',
          consent: true,
        }),
      });
      expect(res.status).toBe(200);
      expect(mockSubscriberService.subscribe).toHaveBeenCalledWith('user@example.com', undefined);
    });

    it('rejects without consent', async () => {
      const res = await app.request('/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'user@example.com',
          consent: false,
        }),
      });
      expect(res.status).toBe(400);
    });

    it('rejects invalid email', async () => {
      const res = await app.request('/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'not-an-email',
          consent: true,
        }),
      });
      expect(res.status).toBe(400);
    });

    it('returns 429 when rate limited', async () => {
      mockEval.mockResolvedValue(4); // Over limit of 3
      mockTtl.mockResolvedValue(300);

      const res = await app.request('/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'user@example.com',
          consent: true,
        }),
      });
      expect(res.status).toBe(429);
    });
  });
});
