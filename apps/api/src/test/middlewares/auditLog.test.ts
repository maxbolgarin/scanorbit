import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import type { Variables } from '../../types/index.js';
import { createChain } from '../helpers/mockDb.js';

const mockInsert = vi.fn(() => createChain([]));

vi.mock('../../lib/db.js', () => ({
  db: {
    insert: (...args: unknown[]) => {
      mockInsert(...args);
      return createChain([]);
    },
  },
  pool: {},
}));

vi.mock('../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../lib/ip.js', () => ({
  getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
}));

import { auditLog } from '../../middlewares/auditLog.js';

describe('auditLog', () => {
  it('logs request for normal paths', async () => {
    const app = new Hono<{ Variables: Variables }>();
    app.use('/api/test', auditLog);
    app.get('/api/test', (c) => c.json({ ok: true }));

    const res = await app.request('/api/test');
    expect(res.status).toBe(200);
    // audit log insert should have been called (fire-and-forget)
    expect(mockInsert).toHaveBeenCalled();
  });

  it('skips health check paths', async () => {
    const app = new Hono<{ Variables: Variables }>();
    app.use('/health', auditLog);
    app.get('/health', (c) => c.json({ ok: true }));

    await app.request('/health');
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('skips /auth/me path', async () => {
    const app = new Hono<{ Variables: Variables }>();
    app.use('/auth/me', auditLog);
    app.get('/auth/me', (c) => c.json({ ok: true }));

    await app.request('/auth/me');
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('does not break response if insert fails', async () => {
    mockInsert.mockImplementation(() => {
      const chain = createChain([]);
      // Override the values method to throw
      (chain as Record<string, unknown>).values = vi.fn(() => {
        throw new Error('DB down');
      });
      return chain;
    });

    const app = new Hono<{ Variables: Variables }>();
    app.use('/api/test', auditLog);
    app.get('/api/test', (c) => c.json({ ok: true }));

    const res = await app.request('/api/test');
    // Response should still succeed even if audit log fails
    expect(res.status).toBe(200);
  });
});
