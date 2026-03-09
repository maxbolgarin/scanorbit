import { describe, it, expect, vi, beforeEach } from 'vitest';
import { jsonBody } from '../setup.js';
import { Hono } from 'hono';
import type { Variables } from '../../types/index.js';
import { createChain } from '../helpers/mockDb.js';

// Track what the select mock returns
let selectResult: unknown[] = [];

vi.mock('../../lib/db.js', () => ({
  db: {
    select: vi.fn(() => createChain(selectResult)),
  },
  pool: {},
}));

vi.mock('../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { requireNoProcessingRestriction } from '../../middlewares/processingRestriction.js';

function createApp() {
  const app = new Hono<{ Variables: Variables }>();
  app.use('/test', (c, next) => {
    c.set('userId', 'user-123');
    c.set('orgId', 'org-123');
    return next();
  });
  app.post('/test', requireNoProcessingRestriction, (c) => c.json({ ok: true }));
  app.onError((err, c) => {
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    return c.json({ error: err.message }, status as 400);
  });
  return app;
}

describe('requireNoProcessingRestriction', () => {
  beforeEach(() => {
    selectResult = [];
  });

  it('passes when user is not restricted', async () => {
    selectResult = [{ processingRestricted: false }];
    const app = createApp();
    const res = await app.request('/test', { method: 'POST' });
    expect(res.status).toBe(200);
  });

  it('returns 403 when user has processing restriction', async () => {
    selectResult = [{ processingRestricted: true }];
    const app = createApp();
    const res = await app.request('/test', { method: 'POST' });
    expect(res.status).toBe(403);
    const body = await jsonBody(res);
    expect(body.error).toContain('processing restriction');
  });

  it('passes when no userId is set', async () => {
    const app = new Hono<{ Variables: Variables }>();
    app.post('/test', requireNoProcessingRestriction, (c) => c.json({ ok: true }));

    const res = await app.request('/test', { method: 'POST' });
    expect(res.status).toBe(200);
  });

  it('passes when user not found in db', async () => {
    selectResult = [];
    const app = createApp();
    const res = await app.request('/test', { method: 'POST' });
    expect(res.status).toBe(200);
  });
});
