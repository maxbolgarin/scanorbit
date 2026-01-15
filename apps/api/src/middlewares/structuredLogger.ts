import type { Context, Next } from 'hono';
import { logger } from '../lib/logger.js';

/**
 * Structured logging middleware for Hono
 * Outputs JSON logs compatible with Loki/Promtail
 */
export async function structuredLoggerMiddleware(c: Context, next: Next) {
  const start = Date.now();
  const requestId = crypto.randomUUID().slice(0, 8);

  // Create request-scoped logger
  const reqLogger = logger.with({
    request_id: requestId,
  });

  // Log incoming request
  reqLogger.debug('request started', {
    method: c.req.method,
    path: c.req.path,
    query: c.req.query(),
    user_agent: c.req.header('user-agent'),
    ip: c.req.header('x-forwarded-for') || c.req.header('x-real-ip'),
  });

  try {
    await next();
  } catch (error) {
    // Log error
    reqLogger.error('request error', error, {
      method: c.req.method,
      path: c.req.path,
    });
    throw error;
  }

  // Calculate duration
  const duration = Date.now() - start;
  const status = c.res.status;

  // Determine log level based on status
  const logData = {
    method: c.req.method,
    path: c.req.path,
    status,
    duration_ms: duration,
  };

  if (status >= 500) {
    reqLogger.error('request completed', undefined, logData);
  } else if (status >= 400) {
    reqLogger.warn('request completed', logData);
  } else {
    reqLogger.debug('request completed', logData);
  }
}
