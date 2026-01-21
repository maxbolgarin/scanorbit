import { readFileSync } from 'fs';
import Redis from 'ioredis';
import { config } from './config.js';

// Determine if TLS is used (rediss:// protocol)
const isTLS = config.redisUrl.startsWith('rediss://');

// Load CA certificate if specified (for self-signed cert validation)
const caCert = process.env.REDIS_CA_CERT
  ? readFileSync(process.env.REDIS_CA_CERT)
  : undefined;

export const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  ...(isTLS && {
    tls: {
      rejectUnauthorized: true,
      ca: caCert,
    },
  }),
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

// ============================================
// Two-Factor Authentication Helpers
// ============================================

const TWO_FACTOR_SETUP_TTL = 10 * 60; // 10 minutes for setup flow
const TWO_FACTOR_CHALLENGE_TTL = 5 * 60; // 5 minutes for login challenge
const TWO_FACTOR_VERIFY_ATTEMPTS_TTL = 15 * 60; // 15 minutes
const MAX_TWO_FACTOR_VERIFY_ATTEMPTS = 5;

function twoFactorSetupKey(userId: string): string {
  return `2fa:setup:${userId}`;
}

function twoFactorChallengeKey(token: string): string {
  return `2fa:challenge:${token}`;
}

function twoFactorVerifyAttemptsKey(identifier: string): string {
  return `2fa:verify_attempts:${identifier}`;
}

export interface TwoFactorSetupData {
  secret: string;
  qrCodeUri: string;
}

export interface TwoFactorChallengeData {
  userId: string;
  type: '2fa_challenge';
  createdAt: number;
}

export const twoFactorStore = {
  // ============================================
  // Setup Flow (temporary secret storage during 2FA setup)
  // ============================================

  /**
   * Store temporary TOTP secret during 2FA setup
   */
  async setSetupSecret(userId: string, data: TwoFactorSetupData): Promise<void> {
    await redis.setex(twoFactorSetupKey(userId), TWO_FACTOR_SETUP_TTL, JSON.stringify(data));
  },

  /**
   * Get temporary TOTP secret during setup
   */
  async getSetupSecret(userId: string): Promise<TwoFactorSetupData | null> {
    const data = await redis.get(twoFactorSetupKey(userId));
    if (!data) return null;
    try {
      return JSON.parse(data) as TwoFactorSetupData;
    } catch {
      return null;
    }
  },

  /**
   * Delete temporary setup secret
   */
  async deleteSetupSecret(userId: string): Promise<void> {
    await redis.del(twoFactorSetupKey(userId));
  },

  // ============================================
  // Login Challenge Flow
  // ============================================

  /**
   * Store 2FA challenge token after password verification
   * Returns the challenge token
   */
  async createChallenge(userId: string): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    const data: TwoFactorChallengeData = {
      userId,
      type: '2fa_challenge',
      createdAt: Date.now(),
    };
    await redis.setex(twoFactorChallengeKey(token), TWO_FACTOR_CHALLENGE_TTL, JSON.stringify(data));
    return token;
  },

  /**
   * Verify and retrieve challenge data
   */
  async getChallenge(token: string): Promise<TwoFactorChallengeData | null> {
    const data = await redis.get(twoFactorChallengeKey(token));
    if (!data) return null;
    try {
      const parsed = JSON.parse(data) as TwoFactorChallengeData;
      if (parsed.type !== '2fa_challenge') return null;
      return parsed;
    } catch {
      return null;
    }
  },

  /**
   * Delete challenge token (after successful verification or expiry)
   */
  async deleteChallenge(token: string): Promise<void> {
    await redis.del(twoFactorChallengeKey(token));
  },

  // ============================================
  // Rate Limiting for 2FA verification
  // ============================================

  /**
   * Check if user can attempt 2FA verification (rate limiting)
   */
  async checkVerifyAttempts(identifier: string): Promise<{ allowed: boolean; attemptsRemaining: number }> {
    const key = twoFactorVerifyAttemptsKey(identifier);
    const attempts = await redis.get(key);
    const count = attempts ? parseInt(attempts, 10) : 0;

    return {
      allowed: count < MAX_TWO_FACTOR_VERIFY_ATTEMPTS,
      attemptsRemaining: Math.max(0, MAX_TWO_FACTOR_VERIFY_ATTEMPTS - count),
    };
  },

  /**
   * Increment verification attempt count
   */
  async incrementVerifyAttempts(identifier: string): Promise<number> {
    const key = twoFactorVerifyAttemptsKey(identifier);
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, TWO_FACTOR_VERIFY_ATTEMPTS_TTL);
    }
    return count;
  },

  /**
   * Reset verification attempts (after successful verification)
   */
  async resetVerifyAttempts(identifier: string): Promise<void> {
    await redis.del(twoFactorVerifyAttemptsKey(identifier));
  },
};

// Need crypto for token generation
import crypto from 'crypto';

// ============================================
// Password Reset Token Helpers
// ============================================

const PASSWORD_RESET_TTL = 60 * 60; // 1 hour

function passwordResetTokenKey(token: string): string {
  return `pwreset:token:${token}`;
}

export const passwordResetStore = {
  /**
   * Store a password reset token with associated email
   * Token expires after 1 hour
   */
  async setToken(token: string, email: string): Promise<void> {
    await redis.setex(passwordResetTokenKey(token), PASSWORD_RESET_TTL, email);
  },

  /**
   * Get the email associated with a reset token
   * Returns null if token doesn't exist or has expired
   */
  async getEmail(token: string): Promise<string | null> {
    return redis.get(passwordResetTokenKey(token));
  },

  /**
   * Delete a password reset token (single-use)
   */
  async deleteToken(token: string): Promise<void> {
    await redis.del(passwordResetTokenKey(token));
  },
};
