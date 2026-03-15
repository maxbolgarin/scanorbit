import type { Context, Next } from 'hono';
import { logger } from '../lib/logger.js';

/**
 * Structured logging middleware for Hono
 * Outputs JSON logs compatible with Loki/Promtail
 */
export async function structuredLoggerMiddleware(c: Context, next: Next) {
  const start = Date.now();

  // Get trace IDs from context (set by requestIdMiddleware)
  const requestId = c.get('requestId') || crypto.randomUUID().slice(0, 8);
  const traceId = c.get('traceId');
  const spanId = c.get('spanId');

  // Create request-scoped logger with trace context
  const reqLogger = logger.with({
    request_id: requestId,
    ...(traceId && { trace_id: traceId }),
    ...(spanId && { span_id: spanId }),
  });

  // Log incoming request
  reqLogger.debug('request started', {
    method: c.req.method,
    path: c.req.path,
    query: c.req.query(),
    user_agent: c.req.header('user-agent'),
    ip: c.req.header('x-forwarded-for') || c.req.header('x-real-ip'),
  });

  let errorCaught: Error | undefined;
  
  try {
    await next();
  } catch (error) {
    // Store error for logging before re-throwing
    errorCaught = error instanceof Error ? error : new Error(String(error));
    throw error;
  }

  // Calculate duration
  const duration = Date.now() - start;
  const status = c.res.status;

  // Try to extract error info from response for error statuses
  let errorInfo: { error?: string; message?: string; details?: unknown } | undefined;
  
  if (status >= 400) {
    // First, try to get error info from context (set by error handler)
    const errorInfoKey = '__error_info__';
    const contextErrorInfo = (c as unknown as { [key: string]: unknown })[errorInfoKey];
    if (contextErrorInfo && typeof contextErrorInfo === 'object') {
      const errInfo = contextErrorInfo as Record<string, unknown>;
      errorInfo = {
        error: typeof errInfo.error === 'string' ? errInfo.error : undefined,
        message: typeof errInfo.message === 'string' ? errInfo.message : undefined,
        details: errInfo.details,
      };
    }
    
    // Try to read from response body if we don't have error info yet
    if (!errorInfo) {
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
              details: bodyObj.details,
            };
          }
        }
      } catch {
        // Ignore errors reading response body - not critical for logging
      }
    }
    
    // Fallback to caught error if we still don't have info
    if (!errorInfo && errorCaught) {
      errorInfo = {
        error: errorCaught.name,
        message: errorCaught.message,
      };
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
    if (errorInfo.details) logData.error_details = errorInfo.details;
  }

  // Use appropriate message and log level based on status
  // Skip logging 401 for auth check endpoints - these are expected when not logged in
  const isAuthCheckEndpoint = c.req.path === '/auth/me' || c.req.path === '/auth/refresh';
  const isExpected401 = status === 401 && isAuthCheckEndpoint;

  if (status >= 500) {
    reqLogger.error('server error', undefined, logData);
  } else if (status === 404) {
    reqLogger.info('not found', logData);
  } else if (status >= 400 && !isExpected401) {
    reqLogger.warn('request failed', logData);
  } else {
    reqLogger.debug('request completed', logData);
  }
}
