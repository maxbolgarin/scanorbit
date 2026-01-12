import type { Context, Next } from 'hono';
import {
  httpRequestsTotal,
  httpRequestDuration,
  httpRequestsInFlight,
} from '../lib/metrics.js';

// Normalize route path by replacing dynamic segments with placeholders
function normalizeRoute(path: string): string {
  // Replace UUID patterns
  let normalized = path.replace(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    ':id'
  );
  // Replace numeric IDs
  normalized = normalized.replace(/\/\d+/g, '/:id');
  // Clean up trailing slashes
  normalized = normalized.replace(/\/+$/, '') || '/';
  return normalized;
}

export async function metricsMiddleware(c: Context, next: Next) {
  // Don't track metrics endpoint itself
  if (c.req.path === '/metrics') {
    return next();
  }

  const startTime = process.hrtime.bigint();
  httpRequestsInFlight.inc();

  try {
    await next();
  } finally {
    httpRequestsInFlight.dec();

    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1e9; // Convert to seconds

    const method = c.req.method;
    const route = normalizeRoute(c.req.path);
    const statusCode = c.res.status.toString();

    httpRequestsTotal.inc({ method, route, status_code: statusCode });
    httpRequestDuration.observe({ method, route, status_code: statusCode }, duration);
  }
}
