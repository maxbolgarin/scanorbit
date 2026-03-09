import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { Variables } from '../../types/index.js';

vi.mock('../../lib/jwt.js', () => ({
  jwt: {
    verifyAccessToken: vi.fn(),
  },
}));

import { requireAuth, optionalAuth } from '../../middlewares/auth.js';
import { jwt } from '../../lib/jwt.js';

function createApp(middleware: typeof requireAuth) {
  const app = new Hono<{ Variables: Variables }>();
  app.use('/test', middleware);
  app.get('/test', (c) =>
    c.json({ userId: c.get('userId'), orgId: c.get('orgId') })
  );
  app.onError((err, c) => {
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    return c.json({ error: err.message }, status as 400);
  });
  return app;
}

describe('requireAuth', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    app = createApp(requireAuth);
  });

  it('returns 401 when no Authorization header', async () => {
    const res = await app.request('/test');
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Missing authentication token');
  });

  it('returns 401 when token is invalid', async () => {
    vi.mocked(jwt.verifyAccessToken).mockRejectedValue(new Error('invalid'));
    const res = await app.request('/test', {
      headers: { Authorization: 'Bearer bad-token' },
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Invalid or expired token');
  });

  it('returns 401 when payload has no userId', async () => {
    vi.mocked(jwt.verifyAccessToken).mockResolvedValue({
      userId: '',
      orgId: null,
      type: 'access',
    });
    const res = await app.request('/test', {
      headers: { Authorization: 'Bearer valid-token' },
    });
    expect(res.status).toBe(401);
  });

  it('sets userId and orgId on context for valid token', async () => {
    vi.mocked(jwt.verifyAccessToken).mockResolvedValue({
      userId: 'user-123',
      orgId: 'org-456',
      type: 'access',
    });
    const res = await app.request('/test', {
      headers: { Authorization: 'Bearer valid-token' },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.userId).toBe('user-123');
    expect(body.orgId).toBe('org-456');
  });

  it('sets empty string orgId when token has null orgId', async () => {
    vi.mocked(jwt.verifyAccessToken).mockResolvedValue({
      userId: 'user-123',
      orgId: null,
      type: 'access',
    });
    const res = await app.request('/test', {
      headers: { Authorization: 'Bearer valid-token' },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.orgId).toBe('');
  });
});

describe('optionalAuth', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    app = createApp(optionalAuth);
  });

  it('passes through without token (no error)', async () => {
    const res = await app.request('/test');
    expect(res.status).toBe(200);
  });

  it('sets user context when valid token provided', async () => {
    vi.mocked(jwt.verifyAccessToken).mockResolvedValue({
      userId: 'user-123',
      orgId: 'org-456',
      type: 'access',
    });
    const res = await app.request('/test', {
      headers: { Authorization: 'Bearer valid-token' },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.userId).toBe('user-123');
  });

  it('ignores invalid token silently', async () => {
    vi.mocked(jwt.verifyAccessToken).mockRejectedValue(new Error('expired'));
    const res = await app.request('/test');
    expect(res.status).toBe(200);
  });
});
