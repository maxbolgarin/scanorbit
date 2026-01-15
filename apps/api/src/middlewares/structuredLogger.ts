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
    // Re-throw unhandled errors - error handler will process them
    throw error;
  }

  // Calculate duration
  const duration = Date.now() - start;
  const status = c.res.status;

  // Try to extract error info from response for error statuses
  let errorInfo: { error?: string; message?: string } | undefined;
  if (status >= 400) {
    try {
      // Clone response to read body without consuming the original
      const clonedRes = c.res.clone();
      const contentType = clonedRes.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        const body = await clonedRes.json().catch(() => null) as unknown;
        if (body && typeof body === 'object' && body !== null) {
          const bodyObj = body as Record<string, unknown>;
          errorInfo = {
            error: typeof bodyObj.error === 'string' ? bodyObj.error : undefined,
            message: typeof bodyObj.message === 'string' ? bodyObj.message : undefined,
          };
        }
      }
    } catch {
      // Ignore errors reading response body - not critical for logging
    }
  }

  // Determine log level and message based on status
  const logData: Record<string, unknown> = {
    method: c.req.method,
    path: c.req.path,
    status,
    duration_ms: duration,
  };

  // Include error info if available
  if (errorInfo) {
    if (errorInfo.error) logData.error_type = errorInfo.error;
    if (errorInfo.message) logData.error_message = errorInfo.message;
  }

  // Use appropriate message and log level based on status
  if (status >= 500) {
    reqLogger.error('server error', undefined, logData);
  } else if (status >= 400) {
    reqLogger.warn('request failed', logData);
  } else {
    reqLogger.debug('request completed', logData);
  }
}
