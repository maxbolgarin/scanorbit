import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

const { mockDebug, mockWarn, mockError, mockChildLogger } = vi.hoisted(() => {
  const mockDebug = vi.fn();
  const mockWarn = vi.fn();
  const mockError = vi.fn();
  const mockChildLogger = {
    debug: mockDebug,
    warn: mockWarn,
    error: mockError,
    info: vi.fn(),
    with: vi.fn(),
  };
  return { mockDebug, mockWarn, mockError, mockChildLogger };
});

vi.mock('../../lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    with: vi.fn().mockReturnValue(mockChildLogger),
  },
}));

import { structuredLoggerMiddleware } from '../../middlewares/structuredLogger.js';

function createApp() {
  const app = new Hono();
  app.use('*', structuredLoggerMiddleware);
  app.get('/api/test', (c) => c.json({ ok: true }));
  app.get('/api/error', (c) => c.json({ error: 'Bad Request' }, 400));
  app.get('/api/server-error', (c) => c.json({ error: 'Internal error' }, 500));
  app.get('/auth/me', (c) => c.json({ error: 'Missing authentication token' }, 401));
  app.get('/auth/refresh', (c) => c.json({ error: 'No refresh token' }, 401));
  app.get('/api/unauthorized', (c) => c.json({ error: 'Unauthorized' }, 401));
  return app;
}

describe('structuredLoggerMiddleware', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    app = createApp();
  });

  it('logs completed request at debug level for 2xx', async () => {
    await app.request('/api/test');
    expect(mockDebug).toHaveBeenCalledWith(
      'request completed',
      expect.objectContaining({ status: 200, duration_ms: expect.any(Number) }),
    );
  });

  it('logs 400 errors at warn level', async () => {
    await app.request('/api/error');
    expect(mockWarn).toHaveBeenCalledWith(
      'request failed',
      expect.objectContaining({ status: 400 }),
    );
  });

  it('logs 500 errors at error level', async () => {
    await app.request('/api/server-error');
    expect(mockError).toHaveBeenCalledWith(
      'server error',
      undefined,
      expect.objectContaining({ status: 500 }),
    );
  });

  it('skips 401 logging on /auth/me (expected auth check)', async () => {
    mockWarn.mockClear();
    await app.request('/auth/me');
    expect(mockWarn).not.toHaveBeenCalled();
    expect(mockDebug).toHaveBeenCalledWith(
      'request completed',
      expect.objectContaining({ status: 401 }),
    );
  });

  it('skips 401 logging on /auth/refresh (expected auth check)', async () => {
    mockWarn.mockClear();
    await app.request('/auth/refresh');
    expect(mockWarn).not.toHaveBeenCalled();
    expect(mockDebug).toHaveBeenCalledWith(
      'request completed',
      expect.objectContaining({ status: 401 }),
    );
  });

  it('logs 401 at warn level on non-auth-check endpoints', async () => {
    await app.request('/api/unauthorized');
    expect(mockWarn).toHaveBeenCalledWith(
      'request failed',
      expect.objectContaining({ status: 401 }),
    );
  });

  it('includes duration_ms in log data', async () => {
    await app.request('/api/test');
    expect(mockDebug).toHaveBeenCalledWith(
      'request completed',
      expect.objectContaining({ duration_ms: expect.any(Number) }),
    );
  });

  it('includes method and path in log data', async () => {
    await app.request('/api/test');
    expect(mockDebug).toHaveBeenCalledWith(
      'request completed',
      expect.objectContaining({ method: 'GET', path: '/api/test' }),
    );
  });

  it('extracts error info from JSON response body', async () => {
    await app.request('/api/error');
    expect(mockWarn).toHaveBeenCalledWith(
      'request failed',
      expect.objectContaining({ error_type: 'Bad Request' }),
    );
  });
});
