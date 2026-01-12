import type { Context, ErrorHandler } from 'hono';
import { HTTPError } from '../lib/errors.js';
import { ZodError } from 'zod';
import { errorsTotal } from '../lib/metrics.js';

export const errorHandler: ErrorHandler = (err: Error, c: Context) => {
  const route = c.req.path;

  // Handle custom HTTP errors
  if (err instanceof HTTPError) {
    errorsTotal.inc({ type: err.name, route });
    return c.json(
      {
        error: err.name,
        message: err.message,
      },
      err.statusCode as 400 | 401 | 403 | 404 | 409 | 500
    );
  }

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    errorsTotal.inc({ type: 'ValidationError', route });
    return c.json(
      {
        error: 'ValidationError',
        message: 'Invalid request data',
        details: err.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        })),
      },
      400
    );
  }

  // Log unexpected errors
  console.error('Unhandled error:', err);
  errorsTotal.inc({ type: 'InternalServerError', route });

  // Return generic error for unexpected errors
  return c.json(
    {
      error: 'InternalServerError',
      message: 'An unexpected error occurred',
    },
    500
  );
};
