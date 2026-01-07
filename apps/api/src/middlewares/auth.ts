import type { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import { jwt } from '../lib/jwt.js';
import { HTTP401Error } from '../lib/errors.js';
import type { Variables } from '../types/index.js';

export const requireAuth = async (
  c: Context<{ Variables: Variables }>,
  next: Next
) => {
  // Try to get token from Authorization header first, then from cookie
  const authHeader = c.req.header('Authorization');
  const token = authHeader?.replace('Bearer ', '') ?? getCookie(c, 'jwt');

  if (!token) {
    throw new HTTP401Error('Missing authentication token');
  }

  try {
    const payload = await jwt.verify(token);

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

// Optional auth - doesn't throw if no token, but sets user if present
export const optionalAuth = async (
  c: Context<{ Variables: Variables }>,
  next: Next
) => {
  const authHeader = c.req.header('Authorization');
  const token = authHeader?.replace('Bearer ', '') ?? getCookie(c, 'jwt');

  if (token) {
    try {
      const payload = await jwt.verify(token);
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
