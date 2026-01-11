import type { Context, Next } from 'hono';
import { db } from '../lib/db.js';
import { auditLogs } from '../db/schema.js';
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

// Extract resource type from path
function getResourceFromPath(path: string): string {
  // Remove /api prefix and get first path segment
  const cleanPath = path.replace(/^\/api\//, '');
  const segments = cleanPath.split('/');

  // Map common paths to resource types
  const resourceMap: Record<string, string> = {
    auth: 'auth',
    users: 'user',
    orgs: 'org',
    'aws-accounts': 'aws_account',
    resources: 'resource',
    findings: 'finding',
    scans: 'scan',
    certificates: 'certificate',
    gdpr: 'gdpr',
    health: 'health',
  };

  return resourceMap[segments[0]] || segments[0] || 'unknown';
}

// Extract resource ID from path (if present)
function getResourceIdFromPath(path: string): string | null {
  // Match UUID pattern in path
  const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  const match = path.match(uuidPattern);
  return match ? match[0] : null;
}

// Check if path should be excluded from audit logging
function shouldExclude(path: string, method: string): boolean {
  // Exclude high-frequency read endpoints to reduce log volume
  const excludePatterns = [
    /^\/api\/health/,           // Health checks
    /^\/$/,                      // Root
    /^\/favicon\.ico/,          // Favicon
  ];

  return excludePatterns.some(pattern => pattern.test(path));
}

// Get client IP from request headers
function getClientIp(c: Context): string | null {
  // Check common proxy headers
  const forwardedFor = c.req.header('x-forwarded-for');
  if (forwardedFor) {
    // Take the first IP if multiple are present
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = c.req.header('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Fallback to CF-Connecting-IP for Cloudflare
  const cfConnectingIp = c.req.header('cf-connecting-ip');
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  return null;
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
  if (shouldExclude(path, method)) {
    return next();
  }

  // Execute the request
  await next();

  // Log after response (non-blocking)
  try {
    const userId = c.get('userId') || null;
    const orgId = c.get('orgId') || null;
    const durationMs = Date.now() - startTime;

    // Don't await - fire and forget to not slow down response
    db.insert(auditLogs)
      .values({
        userId,
        orgId,
        action: getActionFromMethod(method),
        resource: getResourceFromPath(path),
        resourceId: getResourceIdFromPath(path),
        method,
        path,
        statusCode: c.res.status,
        ipAddress: getClientIp(c),
        userAgent: c.req.header('user-agent'),
        durationMs,
      })
      .catch((err) => {
        // Log error but don't throw - audit logging should never break the app
        console.error('[AuditLog] Failed to write audit log:', err);
      });
  } catch (err) {
    // Silently fail - audit logging should never break the app
    console.error('[AuditLog] Error in audit middleware:', err);
  }
};

/**
 * Log specific authentication events
 */
export const logAuthEvent = async (
  action: 'login' | 'logout' | 'login_failed' | 'password_reset' | 'email_verified',
  userId: string | null,
  email: string,
  ipAddress: string | null,
  userAgent: string | null,
  details?: Record<string, unknown>
) => {
  try {
    await db.insert(auditLogs).values({
      userId,
      action,
      resource: 'auth',
      resourceId: email,
      ipAddress,
      userAgent,
      details: details || {},
    });
  } catch (err) {
    console.error('[AuditLog] Failed to log auth event:', err);
  }
};

/**
 * Log data access events (for sensitive operations)
 */
export const logDataAccess = async (
  userId: string,
  orgId: string | null,
  action: 'export' | 'delete' | 'anonymize',
  resource: string,
  resourceId: string | null,
  ipAddress: string | null,
  userAgent: string | null,
  details?: Record<string, unknown>
) => {
  try {
    await db.insert(auditLogs).values({
      userId,
      orgId,
      action,
      resource,
      resourceId,
      ipAddress,
      userAgent,
      details: details || {},
    });
  } catch (err) {
    console.error('[AuditLog] Failed to log data access:', err);
  }
};
