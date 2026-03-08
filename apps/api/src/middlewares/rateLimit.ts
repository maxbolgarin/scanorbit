import type { Context, Next } from 'hono';
import { redis } from '../lib/redis.js';
import { HTTP429Error, HTTP503Error } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { getClientIP } from '../lib/ip.js';
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
 * Uses the secure IP utility that only trusts X-Forwarded-For from trusted proxies.
 * Configure TRUSTED_PROXIES env var with your reverse proxy IPs (e.g., Caddy).
 */
function getRateLimitClientIP(c: Context<{ Variables: Variables }>): string {
  return getClientIP(c);
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
      const identifier = keyExtractor ? keyExtractor(c) : getRateLimitClientIP(c);
      const key = `ratelimit:${keyPrefix}:${identifier}`;

      // Atomic increment + conditional expire via Lua to prevent immortal keys
      const count = await redis.eval(
        'local c = redis.call("INCR", KEYS[1]) if c == 1 then redis.call("EXPIRE", KEYS[1], ARGV[1]) end return c',
        1,
        key,
        windowSeconds,
      ) as number;

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

      // Always fail closed — never bypass rate limiting on Redis errors
      throw new HTTP503Error('Service temporarily unavailable. Please try again later.');
    }
  };
}

interface DualRateLimitOptions {
  /** Key prefix for Redis (e.g., 'verifycode') */
  keyPrefix: string;
  /** Maximum requests per IP in the window */
  maxIPRequests: number;
  /** Maximum requests per email in the window */
  maxEmailRequests: number;
  /** Time window in seconds */
  windowSeconds: number;
  /** Function to extract email from request body */
  emailExtractor: (c: Context<{ Variables: Variables }>) => string;
  /** Custom error message for IP limit */
  ipMessage?: string;
  /** Custom error message for email limit */
  emailMessage?: string;
}

/**
 * Rate limiting middleware that checks BOTH email and IP limits
 * Email limit is stricter to prevent targeted brute force attacks on specific accounts
 * IP limit remains as a fallback to prevent distributed attacks
 *
 * @example
 * app.post('/verify-code', rateLimitByEmailAndIP({
 *   keyPrefix: 'verifycode',
 *   maxIPRequests: 10,
 *   maxEmailRequests: 5,
 *   windowSeconds: 15 * 60,
 *   emailExtractor: (c) => c.req.valid('json').email
 * }), handler)
 */
export function rateLimitByEmailAndIP(options: DualRateLimitOptions) {
  const {
    keyPrefix,
    maxIPRequests,
    maxEmailRequests,
    windowSeconds,
    emailExtractor,
    ipMessage = 'Too many requests from this IP address.',
    emailMessage = 'Too many attempts for this email address.',
  } = options;

  return async (c: Context<{ Variables: Variables }>, next: Next) => {
    // Check circuit breaker first
    if (isCircuitOpen()) {
      logger.error('Circuit breaker open - Redis unavailable, failing closed', undefined, {
        keyPrefix,
        failures: circuitBreaker.failures,
      });
      throw new HTTP503Error('Service temporarily unavailable. Please try again later.');
    }

    try {
      const ip = getRateLimitClientIP(c);
      const email = emailExtractor(c).toLowerCase();

      const ipKey = `ratelimit:${keyPrefix}:ip:${ip}`;
      const emailKey = `ratelimit:${keyPrefix}:email:${email}`;

      // Atomic increment + conditional expire via Lua for both keys
      const luaScript = 'local c = redis.call("INCR", KEYS[1]) if c == 1 then redis.call("EXPIRE", KEYS[1], ARGV[1]) end return c';
      const [ipCount, emailCount] = await Promise.all([
        redis.eval(luaScript, 1, ipKey, windowSeconds) as Promise<number>,
        redis.eval(luaScript, 1, emailKey, windowSeconds) as Promise<number>,
      ]);

      // Get TTLs for headers
      const [ipTTL, emailTTL] = await Promise.all([
        redis.ttl(ipKey),
        redis.ttl(emailKey),
      ]);

      recordSuccess();

      // Check email limit first (stricter)
      if (emailCount > maxEmailRequests) {
        c.header('Retry-After', emailTTL.toString());
        const waitTime = formatWaitTime(emailTTL);
        const errorMessage = waitTime ? `${emailMessage} Please try again in ${waitTime}.` : emailMessage;
        throw new HTTP429Error(errorMessage);
      }

      // Then check IP limit
      if (ipCount > maxIPRequests) {
        c.header('Retry-After', ipTTL.toString());
        const waitTime = formatWaitTime(ipTTL);
        const errorMessage = waitTime ? `${ipMessage} Please try again in ${waitTime}.` : ipMessage;
        throw new HTTP429Error(errorMessage);
      }

      // Set rate limit headers (use the stricter email limits for display)
      c.header('X-RateLimit-Limit', maxEmailRequests.toString());
      c.header('X-RateLimit-Remaining', Math.max(0, maxEmailRequests - emailCount).toString());
      c.header('X-RateLimit-Reset', (Math.floor(Date.now() / 1000) + emailTTL).toString());

      await next();
    } catch (err) {
      if (err instanceof HTTP429Error || err instanceof HTTP503Error) {
        throw err;
      }

      recordFailure();
      logger.error('Redis rate limit error (dual)', err as Error, {
        keyPrefix,
        failures: circuitBreaker.failures,
        threshold: circuitBreaker.threshold,
      });

      // Always fail closed — never bypass rate limiting on Redis errors
      throw new HTTP503Error('Service temporarily unavailable. Please try again later.');
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

  /** Newsletter subscribe: 3 per 10 minutes per IP */
  newsletter: rateLimit({
    keyPrefix: 'newsletter',
    maxRequests: 3,
    windowSeconds: 10 * 60,
    message: 'Too many subscription attempts.',
  }),

  /** Password reset: 3 per hour per IP */
  passwordReset: rateLimit({
    keyPrefix: 'pwreset',
    maxRequests: 3,
    windowSeconds: 60 * 60,
    message: 'Too many password reset requests. Please try again later.',
  }),

  /**
   * Verify code with combined email + IP limiting
   * Email limit: 5 per 15 minutes (stricter to prevent targeted brute force)
   * IP limit: 15 per 15 minutes (allows multiple emails from same IP)
   */
  verifyCodeStrict: (emailExtractor: (c: Context<{ Variables: Variables }>) => string) =>
    rateLimitByEmailAndIP({
      keyPrefix: 'verifycode_strict',
      maxEmailRequests: 5,
      maxIPRequests: 15,
      windowSeconds: 15 * 60,
      emailExtractor,
      emailMessage: 'Too many verification attempts for this email address.',
      ipMessage: 'Too many verification attempts from this IP address.',
    }),

  /**
   * Send code with combined email + IP limiting
   * Email limit: 3 per 5 minutes (prevent spamming one email)
   * IP limit: 10 per 5 minutes (allows multiple emails from same IP)
   */
  sendCodeStrict: (emailExtractor: (c: Context<{ Variables: Variables }>) => string) =>
    rateLimitByEmailAndIP({
      keyPrefix: 'sendcode_strict',
      maxEmailRequests: 3,
      maxIPRequests: 10,
      windowSeconds: 5 * 60,
      emailExtractor,
      emailMessage: 'Too many code requests for this email address.',
      ipMessage: 'Too many code requests from this IP address.',
    }),

  /**
   * Login with combined email + IP limiting
   * Email limit: 5 per 15 minutes (prevent brute force on specific account)
   * IP limit: 20 per 15 minutes (allows multiple accounts from same IP)
   */
  loginStrict: (emailExtractor: (c: Context<{ Variables: Variables }>) => string) =>
    rateLimitByEmailAndIP({
      keyPrefix: 'login_strict',
      maxEmailRequests: 5,
      maxIPRequests: 20,
      windowSeconds: 15 * 60,
      emailExtractor,
      emailMessage: 'Too many login attempts for this account.',
      ipMessage: 'Too many login attempts from this IP address.',
    }),
};
