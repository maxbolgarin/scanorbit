import { describe, it, expect } from 'vitest';
import { jsonBody } from '../setup.js';
import { Hono } from 'hono';
import { requestIdMiddleware } from '../../middlewares/requestId.js';

describe('requestIdMiddleware', () => {
  const app = new Hono();
  app.use('*', requestIdMiddleware);
  app.get('/test', (c) => {
    return c.json({
      requestId: c.get('requestId'),
      traceId: c.get('traceId'),
      spanId: c.get('spanId'),
    });
  });

  it('generates IDs when none provided', async () => {
    const res = await app.request('/test');
    expect(res.status).toBe(200);
    const body = await jsonBody(res);
    expect(body.requestId).toBeTruthy();
    expect(body.traceId).toBeTruthy();
    expect(body.spanId).toBeTruthy();
    expect(res.headers.get('x-request-id')).toBeTruthy();
    expect(res.headers.get('x-trace-id')).toBeTruthy();
  });

  it('uses provided request ID header', async () => {
    const res = await app.request('/test', {
      headers: { 'x-request-id': 'custom-req-id' },
    });
    const body = await jsonBody(res);
    expect(body.requestId).toBe('custom-req-id');
    expect(res.headers.get('x-request-id')).toBe('custom-req-id');
  });

  it('uses provided trace ID header', async () => {
    const res = await app.request('/test', {
      headers: { 'x-trace-id': 'custom-trace-id' },
    });
    const body = await jsonBody(res);
    expect(body.traceId).toBe('custom-trace-id');
    expect(res.headers.get('x-trace-id')).toBe('custom-trace-id');
  });

  it('uses provided span ID header', async () => {
    const res = await app.request('/test', {
      headers: { 'x-span-id': 'custom-span-id' },
    });
    const body = await jsonBody(res);
    expect(body.spanId).toBe('custom-span-id');
  });
});
