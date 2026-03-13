import type { Context, Next } from 'hono';
import { db } from '../lib/db.js';
import { auditLogs } from '../db/schema.js';
import { getClientIP } from '../lib/ip.js';
import { logger } from '../lib/logger.js';
import type { Variables } from '../types/index.js';

/**
 * GDPR Compliance - Audit Logging Middleware
 *
 * Records all API access for security auditing and compliance.
 * Logs: who, what, when, where (IP), and how long.
 */

// Map HTTP methods to action types
function getActionFromMethod(method: string): string {
  switch (method.toUpperCase()) {
    case 'GET':
      return 'read';
    case 'POST':
      return 'create';
    case 'PUT':
    case 'PATCH':
      return 'update';
    case 'DELETE':
      return 'delete';
    default:
      return 'unknown';
  }
}

// Check if path should be excluded from audit logging
function shouldExclude(path: string): boolean {
  // Exclude high-frequency, low-value endpoints to reduce log volume
  const excludePatterns = [
    /^\/$/,                      // Root
    /^(\/api)?\/health/,         // Health checks
    /^(\/api)?\/auth\/me$/,      // Session polling (high frequency)
    /^(\/api)?\/auth\/login$/,   // Login — logged explicitly with real userId via logAuthEvent
    /^(\/api)?\/auth\/logout$/,  // Logout — logged explicitly with real userId via logAuthEvent
    /^\/favicon/,                // Favicon and related
    /^\/robots\.txt/,            // Bots
    /^\/_next\//,                // Next.js internals
    /^\/static\//,               // Static assets
  ];

  return excludePatterns.some(pattern => pattern.test(path));
}

// Get client IP using the trusted proxy validation from lib/ip.ts
function getClientIp(c: Context<{ Variables: Variables }>): string | null {
  const ip = getClientIP(c);
  return ip !== 'unknown' ? ip : null;
}

/**
 * Audit logging middleware
 *
 * Usage: Add to routes that should be audited
 * ```ts
 * app.use('/api/*', auditLog);
 * ```
 */
export const auditLog = async (
  c: Context<{ Variables: Variables }>,
  next: Next
) => {
  const startTime = Date.now();
  const path = c.req.path;
  const method = c.req.method;

  // Skip excluded paths
  if (shouldExclude(path)) {
    return next();
  }

  // Execute the request
  await next();

  // Log after response (non-blocking)
  try {
    const userId = c.get('userId') || null;
    const durationMs = Date.now() - startTime;

    // Don't await - fire and forget to not slow down response
    db.insert(auditLogs)
      .values({
        userId,
        action: getActionFromMethod(method),
        method,
        path,
        statusCode: c.res.status,
        ipAddress: getClientIp(c),
        userAgent: c.req.header('user-agent'),
        durationMs,
      })
      .catch((err) => {
        // Log error but don't throw - audit logging should never break the app
        logger.error('[AuditLog] Failed to write audit log', err as Error);
      });
  } catch (err) {
    // Silently fail - audit logging should never break the app
    logger.error('[AuditLog] Error in audit middleware', err as Error);
  }
};

/**
 * Log specific authentication events
 */
export const logAuthEvent = async (
  action: 'login' | 'logout' | 'login_failed' | 'password_reset' | 'email_verified',
  userId: string | null,
  ipAddress: string | null,
  userAgent: string | null
) => {
  try {
    await db.insert(auditLogs).values({
      userId,
      action,
      path: `/auth/${action}`,
      ipAddress,
      userAgent,
    });
  } catch (err) {
    logger.error('[AuditLog] Failed to log auth event', err as Error);
  }
};

/**
 * Log data access events (for sensitive operations)
 */
export const logDataAccess = async (
  userId: string,
  action: 'export' | 'delete' | 'anonymize' | 'update',
  path: string,
  ipAddress: string | null,
  userAgent: string | null
) => {
  try {
    await db.insert(auditLogs).values({
      userId,
      action,
      path,
      ipAddress,
      userAgent,
    });
  } catch (err) {
    logger.error('[AuditLog] Failed to log data access', err as Error);
  }
};
