import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import type { Variables } from '../../types/index.js';
import { requireOrgId } from '../../middlewares/requireOrgId.js';

function createApp() {
  const app = new Hono<{ Variables: Variables }>();
  app.use('/test', requireOrgId);
  app.get('/test', (c) => c.json({ orgId: c.get('orgId') }));
  app.onError((err, c) => {
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    return c.json({ error: err.message }, status as 400);
  });
  return app;
}

describe('requireOrgId', () => {
  it('returns 400 when orgId is not set', async () => {
    const app = createApp();
    const res = await app.request('/test');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('No organization selected');
  });

  it('returns 400 when orgId is empty string', async () => {
    const app = new Hono<{ Variables: Variables }>();
    app.use('/test', (c, next) => {
      c.set('orgId', '');
      return next();
    });
    app.use('/test', requireOrgId);
    app.get('/test', (c) => c.json({ ok: true }));
    app.onError((err, c) => {
      const status = (err as { statusCode?: number }).statusCode ?? 500;
      return c.json({ error: err.message }, status as 400);
    });

    const res = await app.request('/test');
    expect(res.status).toBe(400);
  });

  it('passes when orgId is present', async () => {
    const app = new Hono<{ Variables: Variables }>();
    app.use('/test', (c, next) => {
      c.set('orgId', 'org-123');
      return next();
    });
    app.use('/test', requireOrgId);
    app.get('/test', (c) => c.json({ orgId: c.get('orgId') }));

    const res = await app.request('/test');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.orgId).toBe('org-123');
  });
});
