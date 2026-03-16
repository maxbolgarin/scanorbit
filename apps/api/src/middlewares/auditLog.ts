import type { Context, Next } from 'hono';
import { db } from '../lib/db.js';
import { auditLogs, consentLogs } from '../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
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
    /^(\/api)?\/stripe\/webhook$/, // Stripe webhooks (system events, not user actions)
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

// Cache of user IDs who have objected to audit logging (TTL-based in-memory cache)
const auditObjectionCache = new Map<string, { objected: boolean; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Check if user has an active GDPR Article 21 objection to audit logging.
 * Uses in-memory cache to avoid per-request DB queries.
 */
async function hasAuditLoggingObjection(userId: string): Promise<boolean> {
  const cached = auditObjectionCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.objected;
  }

  try {
    const [latest] = await db
      .select({ consentGiven: consentLogs.consentGiven, metadata: consentLogs.metadata })
      .from(consentLogs)
      .where(
        and(
          eq(consentLogs.userId, userId),
          eq(consentLogs.consentType, 'objection')
        )
      )
      .orderBy(desc(consentLogs.consentedAt))
      .limit(1);

    // Objection is active if consentGiven=false and the processingActivity is audit_logging
    const objected = latest?.consentGiven === false &&
      typeof latest.metadata === 'object' && latest.metadata !== null &&
      'processingActivity' in latest.metadata &&
      (latest.metadata as Record<string, unknown>).processingActivity === 'audit_logging';

    auditObjectionCache.set(userId, { objected, expiresAt: Date.now() + CACHE_TTL_MS });
    return objected;
  } catch {
    return false; // Fail open — don't break auditing on cache lookup failure
  }
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

    // GDPR Article 21: Skip audit logging for users who have objected
    if (userId) {
      hasAuditLoggingObjection(userId).then((objected) => {
        if (objected) return; // Respect user's objection
        insertAuditLog(userId, method, path, c.res.status, getClientIp(c), c.req.header('user-agent'), durationMs);
      }).catch(() => {
        // On error, log anyway (fail open for security auditing)
        insertAuditLog(userId, method, path, c.res.status, getClientIp(c), c.req.header('user-agent'), durationMs);
      });
      return;
    }

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
 * Insert audit log entry (fire-and-forget)
 */
function insertAuditLog(
  userId: string | null,
  method: string,
  path: string,
  statusCode: number,
  ipAddress: string | null,
  userAgent: string | undefined,
  durationMs: number
): void {
  db.insert(auditLogs)
    .values({
      userId,
      action: getActionFromMethod(method),
      method,
      path,
      statusCode,
      ipAddress,
      userAgent,
      durationMs,
    })
    .catch((err) => {
      logger.error('[AuditLog] Failed to write audit log', err as Error);
    });
}

/**
 * Invalidate the audit objection cache for a user.
 * Call this when a user submits or withdraws an objection.
 */
export function invalidateAuditObjectionCache(userId: string): void {
  auditObjectionCache.delete(userId);
}

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
