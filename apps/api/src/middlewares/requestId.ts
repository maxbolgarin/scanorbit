import type { Context, Next } from 'hono';
import { randomUUID } from 'crypto';

/**
 * Request ID and Trace ID middleware for distributed tracing
 *
 * Generates or propagates trace IDs for log correlation across services:
 * - x-request-id: Unique identifier for this specific request
 * - x-trace-id: Identifier that can be propagated across service boundaries
 *
 * If headers are provided by the client or upstream service, they are reused.
 * Otherwise, new IDs are generated.
 */
export async function requestIdMiddleware(c: Context, next: Next) {
  // Get or generate request ID (unique per request)
  const requestId = c.req.header('x-request-id') || randomUUID().slice(0, 8);

  // Get or generate trace ID (propagated across services)
  // Remove dashes for more compact format in logs
  const traceId = c.req.header('x-trace-id') || randomUUID().replace(/-/g, '');

  // Get span ID if provided (for distributed tracing)
  const spanId = c.req.header('x-span-id') || randomUUID().slice(0, 16).replace(/-/g, '');

  // Store in context for use by other middlewares and handlers
  c.set('requestId', requestId);
  c.set('traceId', traceId);
  c.set('spanId', spanId);

  // Set response headers for client-side correlation
  c.header('x-request-id', requestId);
  c.header('x-trace-id', traceId);

  await next();
}
