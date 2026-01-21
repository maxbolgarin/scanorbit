import type { Context, ErrorHandler } from 'hono';
import { HTTPError } from '../lib/errors.js';
import { ZodError } from 'zod';
import { logger } from '../lib/logger.js';
import { errorsTotal } from '../lib/metrics.js';

export const errorHandler: ErrorHandler = (err: Error, c: Context) => {
  const route = c.req.path;

  // Store error info in context for structured logger to access
  // Use a symbol or string key that won't conflict
  const errorInfoKey = '__error_info__';
  
  // Handle custom HTTP errors
  if (err instanceof HTTPError) {
    errorsTotal.inc({ type: err.name, route });
    
    // Store error info in context for structured logger
    (c as unknown as { [key: string]: unknown })[errorInfoKey] = {
      error: err.name,
      message: err.message,
      statusCode: err.statusCode,
    };
    
    // Log all errors for debugging - use warn for 4xx, error for 5xx
    const logContext = {
      statusCode: err.statusCode,
      method: c.req.method,
      path: c.req.path,
      error: err.name,
      message: err.message,
      query: c.req.query(),
    };
    
    if (err.statusCode >= 500) {
      logger.error('HTTP error', err, logContext);
    } else {
      logger.warn('HTTP error', {
        ...logContext,
        error: err.message,
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
    errorsTotal.inc({ type: 'ValidationError', route });
    
    // Store error info in context for structured logger
    (c as unknown as { [key: string]: unknown })[errorInfoKey] = {
      error: 'ValidationError',
      message: 'Invalid request data',
      details: err.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    };
    
    // Log validation errors for debugging
    logger.warn('Validation error', {
      method: c.req.method,
      path: c.req.path,
      query: c.req.query(),
      error: err.message,
      errors: err.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    });
    
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

  // Check if it's a database error (PostgreSQL errors have specific properties)
  const dbError = err as Error & { code?: string; detail?: string; hint?: string; position?: string };
  const isDatabaseError = dbError.code !== undefined || err.message.includes('Failed query') || err.message.includes('column') || err.message.includes('relation');

  if (isDatabaseError) {
    errorsTotal.inc({ type: 'DatabaseError', route });
    
    // Log database errors with full details for debugging
    logger.error('Database error', err, {
      method: c.req.method,
      path: c.req.path,
      dbCode: dbError.code,
      detail: dbError.detail,
      hint: dbError.hint,
      position: dbError.position,
      message: err.message,
      stack: err.stack,
    });

    // Return generic error (don't expose database structure)
    return c.json(
      {
        error: 'DatabaseError',
        message: 'A database error occurred. Please try again later.',
      },
      500
    );
  }

  // Log unexpected errors with structured logging (redacts sensitive data)
  logger.error('Unhandled error', err, {
    method: c.req.method,
    path: c.req.path,
    message: err.message,
    stack: err.stack,
  });
  errorsTotal.inc({ type: 'InternalServerError', route });

  // Return generic error for unexpected errors (never expose internal details)
  return c.json(
    {
      error: 'InternalServerError',
      message: 'An unexpected error occurred',
    },
    500
  );
};
