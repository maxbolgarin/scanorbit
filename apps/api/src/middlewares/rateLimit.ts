import type { Context, Next } from 'hono';
import { redis } from '../lib/redis.js';
import { HTTP429Error, HTTP503Error } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { getClientIPUnsafe } from '../lib/ip.js';
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

// Circuit breaker state for Redis failures
// When Redis fails repeatedly, we fail-closed to prevent brute force attacks
const circuitBreaker = {
  failures: 0,
  lastFailure: 0,
  threshold: 5, // Number of failures before circuit opens
  resetTimeout: 60000, // 1 minute before attempting to reset
};

/**
 * Check if circuit breaker is open (Redis is unavailable)
 * Circuit resets after resetTimeout if no new failures
 */
function isCircuitOpen(): boolean {
  if (circuitBreaker.failures >= circuitBreaker.threshold) {
    const timeSinceLastFailure = Date.now() - circuitBreaker.lastFailure;
    if (timeSinceLastFailure > circuitBreaker.resetTimeout) {
      // Try to reset the circuit
      circuitBreaker.failures = 0;
      return false;
    }
    return true;
  }
  return false;
}

/**
 * Record a Redis failure
 */
function recordFailure(): void {
  circuitBreaker.failures++;
  circuitBreaker.lastFailure = Date.now();
}

/**
 * Record a Redis success (reset failure count)
 */
function recordSuccess(): void {
  circuitBreaker.failures = 0;
}

/**
 * Get client IP address from request
 * Uses the centralized IP utility for consistent handling
 * Note: For rate limiting, we use the unsafe version since we need to
 * rate limit even if the proxy isn't in the trusted list
 */
function getClientIP(c: Context<{ Variables: Variables }>): string {
  return getClientIPUnsafe(c);
}

/**
 * Format TTL (time to live in seconds) into human-readable wait time
 * Examples: "2 minutes", "45 seconds", "1 minute"
 */
function formatWaitTime(ttl: number): string {
  if (ttl <= 0) {
    return '';
  }

  const minutes = Math.floor(ttl / 60);
  const seconds = ttl % 60;

  if (minutes > 0) {
    const minuteText = minutes === 1 ? 'minute' : 'minutes';
    if (seconds > 0) {
      const secondText = seconds === 1 ? 'second' : 'seconds';
      return `${minutes} ${minuteText} and ${seconds} ${secondText}`;
    }
    return `${minutes} ${minuteText}`;
  }

  const secondText = seconds === 1 ? 'second' : 'seconds';
  return `${seconds} ${secondText}`;
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
    // Check circuit breaker first - if Redis has been failing, fail-closed for security
    if (isCircuitOpen()) {
      logger.error('Circuit breaker open - Redis unavailable, failing closed', undefined, {
        keyPrefix,
        failures: circuitBreaker.failures,
      });
      throw new HTTP503Error('Service temporarily unavailable. Please try again later.');
    }

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

      // Record successful Redis operation
      recordSuccess();

      // Set rate limit headers
      c.header('X-RateLimit-Limit', maxRequests.toString());
      c.header('X-RateLimit-Remaining', Math.max(0, maxRequests - count).toString());
      c.header('X-RateLimit-Reset', (Math.floor(Date.now() / 1000) + ttl).toString());

      // Check if over limit
      if (count > maxRequests) {
        c.header('Retry-After', ttl.toString());
        // Format wait time into human-readable message
        const waitTime = formatWaitTime(ttl);
        const errorMessage = waitTime ? `${message} Please try again in ${waitTime}.` : message;
        throw new HTTP429Error(errorMessage);
      }

      await next();
    } catch (err) {
      // Re-throw HTTP errors (rate limit exceeded, service unavailable)
      if (err instanceof HTTP429Error || err instanceof HTTP503Error) {
        throw err;
      }

      // Record Redis failure for circuit breaker
      recordFailure();
      logger.error('Redis rate limit error', err as Error, {
        keyPrefix,
        failures: circuitBreaker.failures,
        threshold: circuitBreaker.threshold,
      });

      // If we've hit the threshold, fail closed for security
      if (isCircuitOpen()) {
        throw new HTTP503Error('Service temporarily unavailable. Please try again later.');
      }

      // Allow a few failures before failing closed (graceful degradation)
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
    message: 'Too many verification code requests',
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
