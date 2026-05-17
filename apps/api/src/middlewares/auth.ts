import type { Context, Next } from 'hono';
import { jwt } from '../lib/jwt.js';
import { HTTP401Error } from '../lib/errors.js';
import type { Variables } from '../types/index.js';
import { config } from '../lib/config.js';
import { ensureSystemUserAndOrg } from '../services/auth/systemUser.js';

/**
 * Authentication middleware that requires a valid access token
 *
 * Access token must be provided in the Authorization header:
 * Authorization: Bearer <access_token>
 *
 * The access token is short-lived (5 min). When it expires,
 * frontend should call POST /auth/refresh to get a new one
 * using the refresh_token cookie.
 */
export const requireAuth = async (
  c: Context<{ Variables: Variables }>,
  next: Next
) => {
  // Single-user mode: every request is the built-in admin. No token required.
  if (!config.authEnabled) {
    const { userId, orgId } = await ensureSystemUserAndOrg();
    c.set('userId', userId);
    c.set('orgId', orgId);
    await next();
    return;
  }

  const authHeader = c.req.header('Authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    throw new HTTP401Error('Missing authentication token');
  }

  try {
    const payload = await jwt.verifyAccessToken(token);

    if (!payload.userId) {
      throw new HTTP401Error('Invalid token payload');
    }

    c.set('userId', payload.userId);
    c.set('orgId', payload.orgId ?? '');
  } catch (error) {
    if (error instanceof HTTP401Error) {
      throw error;
    }
    throw new HTTP401Error('Invalid or expired token');
  }

  await next();
};

/**
 * Optional auth middleware - doesn't throw if no token, but sets user if present
 * Useful for endpoints that work for both authenticated and unauthenticated users
 */
export const optionalAuth = async (
  c: Context<{ Variables: Variables }>,
  next: Next
) => {
  // Single-user mode: always authenticated as the built-in admin.
  if (!config.authEnabled) {
    const { userId, orgId } = await ensureSystemUserAndOrg();
    c.set('userId', userId);
    c.set('orgId', orgId);
    await next();
    return;
  }

  const authHeader = c.req.header('Authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (token) {
    try {
      const payload = await jwt.verifyAccessToken(token);
      if (payload.userId) {
        c.set('userId', payload.userId);
        c.set('orgId', payload.orgId ?? '');
      }
    } catch {
      // Ignore invalid tokens for optional auth
    }
  }

  await next();
};
