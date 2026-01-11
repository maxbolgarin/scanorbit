import type { Context, Next } from 'hono';
import { redis } from '../lib/redis.js';
import { HTTP429Error } from '../lib/errors.js';
import type { Variables } from '../types/index.js';

interface RateLimitOptions {
  /** Key prefix for Redis (e.g., 'login', 'signup') */
  keyPrefix: string;
  /** Maximum number of requests allowed in the window */
  maxRequests: number;
  /** Time window in seconds */
  windowSeconds: number;
  /** Function to extract identifier from request (default: IP address) */
  keyExtractor?: (c: Context<{ Variables: Variables }>) => string;
  /** Custom error message */
  message?: string;
}

/**
 * Get client IP address from request
 * Handles proxied requests via x-forwarded-for header
 */
function getClientIP(c: Context<{ Variables: Variables }>): string {
  // In production, trust only specific headers from trusted proxies
  const forwarded = c.req.header('x-forwarded-for');
  if (forwarded) {
    // Take the first IP (original client)
    return forwarded.split(',')[0].trim();
  }
  const realIP = c.req.header('x-real-ip');
  if (realIP) {
    return realIP.trim();
  }
  // Fallback - may not work in all environments
  return 'unknown';
}

/**
 * Rate limiting middleware using Redis sliding window
 *
 * @example
 * // Limit to 5 login attempts per 15 minutes
 * app.post('/login', rateLimit({ keyPrefix: 'login', maxRequests: 5, windowSeconds: 900 }), handler)
 *
 * @example
 * // Rate limit by email instead of IP
 * app.post('/send-code', rateLimit({
 *   keyPrefix: 'sendcode',
 *   maxRequests: 3,
 *   windowSeconds: 300,
 *   keyExtractor: (c) => c.req.valid('json').email
 * }), handler)
 */
export function rateLimit(options: RateLimitOptions) {
  const {
    keyPrefix,
    maxRequests,
    windowSeconds,
    keyExtractor,
    message = 'Too many requests. Please try again later.',
  } = options;

  return async (c: Context<{ Variables: Variables }>, next: Next) => {
    try {
      // Get identifier (IP or custom)
      const identifier = keyExtractor ? keyExtractor(c) : getClientIP(c);
      const key = `ratelimit:${keyPrefix}:${identifier}`;

      // Increment counter
      const count = await redis.incr(key);

      // Set expiry on first request
      if (count === 1) {
        await redis.expire(key, windowSeconds);
      }

      // Get remaining TTL for headers
      const ttl = await redis.ttl(key);

      // Set rate limit headers
      c.header('X-RateLimit-Limit', maxRequests.toString());
      c.header('X-RateLimit-Remaining', Math.max(0, maxRequests - count).toString());
      c.header('X-RateLimit-Reset', (Math.floor(Date.now() / 1000) + ttl).toString());

      // Check if over limit
      if (count > maxRequests) {
        c.header('Retry-After', ttl.toString());
        throw new HTTP429Error(message);
      }

      await next();
    } catch (err) {
      // If Redis fails, allow the request (fail open)
      // Log the error but don't block the request
      if (err instanceof HTTP429Error) {
        throw err;
      }
      console.error('[RateLimit] Redis error, failing open:', err);
      await next();
    }
  };
}

/**
 * Predefined rate limiters for common use cases
 */
export const rateLimiters = {
  /** Login: 5 attempts per 15 minutes per IP */
  login: rateLimit({
    keyPrefix: 'login',
    maxRequests: 5,
    windowSeconds: 15 * 60,
    message: 'Too many login attempts. Please wait 15 minutes.',
  }),

  /** Send verification code: 3 per 5 minutes per IP */
  sendCode: rateLimit({
    keyPrefix: 'sendcode',
    maxRequests: 3,
    windowSeconds: 5 * 60,
    message: 'Too many verification code requests. Please wait a few minutes.',
  }),

  /** Verify code: 10 attempts per 15 minutes per IP */
  verifyCode: rateLimit({
    keyPrefix: 'verifycode',
    maxRequests: 10,
    windowSeconds: 15 * 60,
    message: 'Too many verification attempts. Please wait 15 minutes.',
  }),

  /** General API: 100 requests per minute per IP */
  api: rateLimit({
    keyPrefix: 'api',
    maxRequests: 100,
    windowSeconds: 60,
    message: 'Too many requests. Please slow down.',
  }),

  /** Password reset: 3 per hour per IP */
  passwordReset: rateLimit({
    keyPrefix: 'pwreset',
    maxRequests: 3,
    windowSeconds: 60 * 60,
    message: 'Too many password reset requests. Please try again later.',
  }),
};
