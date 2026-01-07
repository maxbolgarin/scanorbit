import type { Context, ErrorHandler } from 'hono';
import { HTTPError } from '../lib/errors.js';
import { ZodError } from 'zod';

export const errorHandler: ErrorHandler = (err: Error, c: Context) => {
  // Handle custom HTTP errors
  if (err instanceof HTTPError) {
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

  // Return generic error for unexpected errors
  return c.json(
    {
      error: 'InternalServerError',
      message: 'An unexpected error occurred',
    },
    500
  );
};
