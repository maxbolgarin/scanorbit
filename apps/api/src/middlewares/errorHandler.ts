import type { Context, ErrorHandler } from 'hono';
import { HTTPError } from '../lib/errors.js';
import { ZodError } from 'zod';
import { logger } from '../lib/logger.js';

export const errorHandler: ErrorHandler = (err: Error, c: Context) => {
  // Handle custom HTTP errors
  if (err instanceof HTTPError) {
    // Log 5xx errors, skip logging expected client errors
    if (err.statusCode >= 500) {
      logger.error('HTTP error', err, {
        statusCode: err.statusCode,
        method: c.req.method,
        path: c.req.path,
      });
    }

    return c.json(
      {
        error: err.name,
        message: err.message,
      },
      err.statusCode as 400 | 401 | 403 | 404 | 409 | 429 | 500 | 503
    );
  }

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    // Don't log validation errors - they're expected user input issues
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

  // Log unexpected errors with structured logging (redacts sensitive data)
  logger.error('Unhandled error', err, {
    method: c.req.method,
    path: c.req.path,
  });

  // Return generic error for unexpected errors (never expose internal details)
  return c.json(
    {
      error: 'InternalServerError',
      message: 'An unexpected error occurred',
    },
    500
  );
};
