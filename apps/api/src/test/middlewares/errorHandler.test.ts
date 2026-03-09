import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { z } from 'zod';

vi.mock('../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), fatal: vi.fn() },
}));

vi.mock('../../lib/metrics.js', () => ({
  errorsTotal: { inc: vi.fn() },
}));

import { errorHandler } from '../../middlewares/errorHandler.js';
import {
  HTTP400Error,
  HTTP401Error,
  HTTP403Error,
  HTTP404Error,
  HTTP500Error,
} from '../../lib/errors.js';

function createApp(thrower: () => never) {
  const app = new Hono();
  app.get('/test', () => {
    thrower();
  });
  app.onError(errorHandler);
  return app;
}

describe('errorHandler', () => {
  it('handles HTTP400Error', async () => {
    const app = createApp(() => {
      throw new HTTP400Error('Invalid email');
    });
    const res = await app.request('/test');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('HTTP400Error');
    expect(body.message).toBe('Invalid email');
  });

  it('handles HTTP401Error', async () => {
    const app = createApp(() => {
      throw new HTTP401Error();
    });
    const res = await app.request('/test');
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('HTTP401Error');
  });

  it('handles HTTP403Error', async () => {
    const app = createApp(() => {
      throw new HTTP403Error('Forbidden access');
    });
    const res = await app.request('/test');
    expect(res.status).toBe(403);
  });

  it('handles HTTP404Error', async () => {
    const app = createApp(() => {
      throw new HTTP404Error('Resource not found');
    });
    const res = await app.request('/test');
    expect(res.status).toBe(404);
  });

  it('handles HTTP500Error', async () => {
    const app = createApp(() => {
      throw new HTTP500Error();
    });
    const res = await app.request('/test');
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('HTTP500Error');
  });

  it('handles ZodError as 400 with details', async () => {
    // Use z.parse to generate a real ZodError (avoids cross-module instanceof issues)
    const app = new Hono();
    app.get('/test', () => {
      const schema = z.object({ email: z.string() });
      schema.parse({ email: 123 }); // Will throw ZodError
    });
    app.onError(errorHandler);

    const res = await app.request('/test');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('ValidationError');
    expect(body.message).toBe('Invalid request data');
    expect(body.details).toBeDefined();
    expect(body.details.length).toBeGreaterThan(0);
  });

  it('handles database error as 500 with generic message', async () => {
    const app = createApp(() => {
      const err = new Error('relation "users" does not exist') as Error & { code: string };
      err.code = '42P01';
      throw err;
    });
    const res = await app.request('/test');
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('DatabaseError');
    expect(body.message).toContain('database error');
  });

  it('handles unexpected error as 500', async () => {
    const app = createApp(() => {
      throw new Error('Something unexpected');
    });
    const res = await app.request('/test');
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('InternalServerError');
    expect(body.message).toBe('An unexpected error occurred');
  });
});
