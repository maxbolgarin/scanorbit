import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { Variables } from '../../types/index.js';

const { mockEval, mockTtl } = vi.hoisted(() => ({
  mockEval: vi.fn().mockResolvedValue(1),
  mockTtl: vi.fn().mockResolvedValue(60),
}));

vi.mock('../../lib/redis.js', () => ({
  redis: {
    eval: mockEval,
    ttl: mockTtl,
    on: vi.fn(),
  },
}));

vi.mock('../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../lib/ip.js', () => ({
  getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
}));

import { rateLimit } from '../../middlewares/rateLimit.js';

function createApp(maxRequests = 5) {
  const app = new Hono<{ Variables: Variables }>();
  const limiter = rateLimit({
    keyPrefix: 'test',
    maxRequests,
    windowSeconds: 60,
  });
  app.get('/test', limiter, (c) => c.json({ ok: true }));
  app.onError((err, c) => {
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    return c.json({ error: err.message }, status as 400);
  });
  return app;
}

describe('rateLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEval.mockResolvedValue(1);
    mockTtl.mockResolvedValue(60);
  });

  it('passes when under limit', async () => {
    const app = createApp(5);
    const res = await app.request('/test');
    expect(res.status).toBe(200);
    expect(res.headers.get('X-RateLimit-Limit')).toBe('5');
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('4');
  });

  it('returns 429 when over limit', async () => {
    mockEval.mockResolvedValue(6); // Over limit of 5
    mockTtl.mockResolvedValue(45);

    const app = createApp(5);
    const res = await app.request('/test');
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('45');
  });

  it('returns 503 when Redis fails', async () => {
    mockEval.mockRejectedValue(new Error('Connection refused'));

    const app = createApp(5);
    const res = await app.request('/test');
    expect(res.status).toBe(503);
  });

  it('sets correct remaining count', async () => {
    mockEval.mockResolvedValue(3);

    const app = createApp(5);
    const res = await app.request('/test');
    expect(res.status).toBe(200);
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('2');
  });
});
