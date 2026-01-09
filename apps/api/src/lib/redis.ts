import Redis from 'ioredis';
import { config } from './config.js';

export const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

redis.on('error', (err) => {
  console.error('Redis connection error:', err);
});

redis.on('connect', () => {
  console.log('Connected to Redis');
});

// ============================================
// Signup Code Storage Helpers
// ============================================

const SIGNUP_CODE_TTL = 5 * 60; // 5 minutes
const SIGNUP_ATTEMPTS_TTL = 15 * 60; // 15 minutes
const SIGNUP_RESEND_COOLDOWN = 60; // 60 seconds
const MAX_SIGNUP_ATTEMPTS = 5;

function signupCodeKey(email: string): string {
  return `signup:code:${email.toLowerCase()}`;
}

function signupAttemptsKey(email: string): string {
  return `signup:attempts:${email.toLowerCase()}`;
}

function signupResendKey(email: string): string {
  return `signup:resend:${email.toLowerCase()}`;
}

export const signupCodes = {
  /**
   * Store a verification code for signup
   */
  async setCode(email: string, code: string): Promise<void> {
    await redis.setex(signupCodeKey(email), SIGNUP_CODE_TTL, code);
  },

  /**
   * Get the stored verification code
   */
  async getCode(email: string): Promise<string | null> {
    return redis.get(signupCodeKey(email));
  },

  /**
   * Delete the verification code (after successful verification)
   */
  async deleteCode(email: string): Promise<void> {
    await redis.del(signupCodeKey(email));
  },

  /**
   * Check if user can attempt verification (rate limiting)
   * Returns { allowed: boolean, attemptsRemaining: number }
   */
  async checkAttempts(email: string): Promise<{ allowed: boolean; attemptsRemaining: number }> {
    const key = signupAttemptsKey(email);
    const attempts = await redis.get(key);
    const count = attempts ? parseInt(attempts, 10) : 0;

    return {
      allowed: count < MAX_SIGNUP_ATTEMPTS,
      attemptsRemaining: Math.max(0, MAX_SIGNUP_ATTEMPTS - count),
    };
  },

  /**
   * Increment attempt count
   */
  async incrementAttempts(email: string): Promise<number> {
    const key = signupAttemptsKey(email);
    const count = await redis.incr(key);
    // Set TTL only on first attempt
    if (count === 1) {
      await redis.expire(key, SIGNUP_ATTEMPTS_TTL);
    }
    return count;
  },

  /**
   * Reset attempt count (after successful signup)
   */
  async resetAttempts(email: string): Promise<void> {
    await redis.del(signupAttemptsKey(email));
  },

  /**
   * Check if resend is allowed (cooldown)
   * Returns { allowed: boolean, waitSeconds: number }
   */
  async checkResendCooldown(email: string): Promise<{ allowed: boolean; waitSeconds: number }> {
    const key = signupResendKey(email);
    const ttl = await redis.ttl(key);

    if (ttl > 0) {
      return { allowed: false, waitSeconds: ttl };
    }
    return { allowed: true, waitSeconds: 0 };
  },

  /**
   * Set resend cooldown
   */
  async setResendCooldown(email: string): Promise<void> {
    await redis.setex(signupResendKey(email), SIGNUP_RESEND_COOLDOWN, '1');
  },

  /**
   * Clean up all signup data for an email (after successful signup)
   */
  async cleanup(email: string): Promise<void> {
    await Promise.all([
      redis.del(signupCodeKey(email)),
      redis.del(signupAttemptsKey(email)),
      redis.del(signupResendKey(email)),
    ]);
  },
};
