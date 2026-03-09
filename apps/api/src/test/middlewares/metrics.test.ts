import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

const { mockInc, mockDec, mockObserve } = vi.hoisted(() => ({
  mockInc: vi.fn(),
  mockDec: vi.fn(),
  mockObserve: vi.fn(),
}));

vi.mock('../../lib/metrics.js', () => ({
  httpRequestsTotal: { inc: mockInc },
  httpRequestDuration: { observe: mockObserve },
  httpRequestsInFlight: { inc: mockInc, dec: mockDec },
}));

import { metricsMiddleware } from '../../middlewares/metrics.js';

function createApp() {
  const app = new Hono();
  app.use('*', metricsMiddleware);
  app.get('/api/test', (c) => c.json({ ok: true }));
  app.get('/api/users/:id', (c) => c.json({ id: c.req.param('id') }));
  app.get('/metrics', (c) => c.text('metrics'));
  return app;
}

describe('metricsMiddleware', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    app = createApp();
  });

  it('increments and decrements in-flight counter', async () => {
    await app.request('/api/test');
    expect(mockInc).toHaveBeenCalled();
    expect(mockDec).toHaveBeenCalled();
  });

  it('records request duration', async () => {
    await app.request('/api/test');
    expect(mockObserve).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'GET', status_code: '200' }),
      expect.any(Number),
    );
  });

  it('skips /metrics endpoint', async () => {
    mockInc.mockClear();
    mockObserve.mockClear();
    await app.request('/metrics');
    expect(mockObserve).not.toHaveBeenCalled();
  });

  it('normalizes UUID segments to :id', async () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    app.get(`/api/items/${uuid}`, (c) => c.json({ ok: true }));
    await app.request(`/api/items/${uuid}`);
    expect(mockInc).toHaveBeenCalledWith(
      expect.objectContaining({ route: '/api/items/:id' }),
    );
  });

  it('normalizes numeric segments to :id', async () => {
    app.get('/api/items/12345', (c) => c.json({ ok: true }));
    await app.request('/api/items/12345');
    expect(mockInc).toHaveBeenCalledWith(
      expect.objectContaining({ route: '/api/items/:id' }),
    );
  });

  it('preserves non-dynamic paths', async () => {
    await app.request('/api/test');
    expect(mockInc).toHaveBeenCalledWith(
      expect.objectContaining({ route: '/api/test' }),
    );
  });
});
