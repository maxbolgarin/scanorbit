import crypto from 'crypto';
import { readFileSync } from 'fs';
import Redis from 'ioredis';
import { config } from './config.js';
import { logger } from './logger.js';

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
      minVersion: 'TLSv1.3',
    },
  }),
});

redis.on('error', (err) => {
  logger.error('Redis connection error', err);
});

redis.on('connect', () => {
  logger.info('Connected to Redis');
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
// TOTP Replay Protection
// ============================================

import { TOTP_REPLAY_TTL } from './totp.js';

function totpUsedKey(userId: string, code: string): string {
  return `totp:used:${userId}:${code}`;
}

export const totpReplayStore = {
  /**
   * Check if a TOTP code has already been used (replay attack prevention).
   * Returns true if the code was already consumed.
   */
  async isCodeUsed(userId: string, code: string): Promise<boolean> {
    const exists = await redis.exists(totpUsedKey(userId, code));
    return exists === 1;
  },

  /**
   * Mark a TOTP code as used. The key auto-expires after the TOTP validity window.
   */
  async markCodeUsed(userId: string, code: string): Promise<void> {
    await redis.setex(totpUsedKey(userId, code), TOTP_REPLAY_TTL, '1');
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

// ============================================
// Account Lockout Helpers (Protection against brute force)
// ============================================

const ACCOUNT_LOCKOUT_TTL = 60 * 60; // 1 hour lockout
const ACCOUNT_LOCKOUT_THRESHOLD = 10; // Lock after 10 failed attempts

function accountLockoutKey(email: string): string {
  return `account:lockout:${email.toLowerCase()}`;
}

export const accountLockoutStore = {
  /**
   * Check if an account is locked
   * Returns { locked: boolean, failedAttempts: number, remainingLockoutSeconds: number }
   */
  async checkLockout(email: string): Promise<{ locked: boolean; failedAttempts: number; remainingLockoutSeconds: number }> {
    const key = accountLockoutKey(email);
    const [attempts, ttl] = await Promise.all([
      redis.get(key),
      redis.ttl(key),
    ]);
    const count = attempts ? parseInt(attempts, 10) : 0;

    return {
      locked: count >= ACCOUNT_LOCKOUT_THRESHOLD,
      failedAttempts: count,
      remainingLockoutSeconds: ttl > 0 ? ttl : 0,
    };
  },

  /**
   * Record a failed login attempt
   * Returns the new count of failed attempts
   */
  async recordFailedAttempt(email: string): Promise<number> {
    const key = accountLockoutKey(email);
    const count = await redis.incr(key);
    // Reset TTL on each failure to extend lockout window
    await redis.expire(key, ACCOUNT_LOCKOUT_TTL);
    return count;
  },

  /**
   * Clear lockout (after successful login or password reset)
   */
  async clearLockout(email: string): Promise<void> {
    await redis.del(accountLockoutKey(email));
  },

  /**
   * Get remaining lockout time in seconds
   */
  async getRemainingLockoutTime(email: string): Promise<number> {
    const ttl = await redis.ttl(accountLockoutKey(email));
    return ttl > 0 ? ttl : 0;
  },
};

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

// ============================================
// Refresh Token Storage Helpers
// ============================================

// 7 days + 10 minutes buffer to prevent TTL race with JWT expiry
const REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60 + 600;

function refreshTokenKey(tokenId: string): string {
  return `refresh:${tokenId}`;
}

function userRefreshTokensKey(userId: string): string {
  return `refresh:user:${userId}`;
}

export const refreshTokenStore = {
  /**
   * Store a refresh token ID for a user
   * The tokenId maps to userId for validation
   * Also tracks user's active tokens in a set for bulk revocation
   */
  async store(tokenId: string, userId: string): Promise<void> {
    const tokenLog = tokenId.slice(0, 8) + '...';
    const userLog = userId.slice(0, 8) + '...';

    logger.debug('[RefreshToken] Storing token', { tokenId: tokenLog, userId: userLog });

    const pipeline = redis.pipeline();

    // Store tokenId -> userId mapping with TTL
    pipeline.setex(refreshTokenKey(tokenId), REFRESH_TOKEN_TTL, userId);

    // Add tokenId to user's set of active tokens
    pipeline.sadd(userRefreshTokensKey(userId), tokenId);

    // Set TTL on the user's token set (refreshed on each new token)
    pipeline.expire(userRefreshTokensKey(userId), REFRESH_TOKEN_TTL);

    const results = await pipeline.exec();

    // Check for pipeline errors - pipeline.exec() returns [error, result][] tuples
    // where errors are NOT thrown automatically
    if (!results) {
      logger.error('[RefreshToken] Pipeline returned null', { tokenId: tokenLog });
      throw new Error('Failed to store refresh token: pipeline returned null');
    }

    for (let i = 0; i < results.length; i++) {
      const [error] = results[i];
      if (error) {
        logger.error(`[RefreshToken] Pipeline command ${i} failed`, error as Error, { tokenId: tokenLog });
        throw new Error(`Failed to store refresh token: ${error.message}`);
      }
    }

    // Verify token was actually stored
    const exists = await redis.exists(refreshTokenKey(tokenId));
    if (exists !== 1) {
      logger.error('[RefreshToken] Verification failed - token not found after store', { tokenId: tokenLog });
      throw new Error('Failed to store refresh token: verification failed');
    }

    logger.debug('[RefreshToken] Successfully stored and verified', { tokenId: tokenLog });
  },

  /**
   * Check if a refresh token ID is valid (not revoked)
   * Returns the userId if valid, null otherwise
   */
  async validate(tokenId: string): Promise<string | null> {
    return redis.get(refreshTokenKey(tokenId));
  },

  /**
   * Check if a refresh token ID exists
   */
  async isValid(tokenId: string): Promise<boolean> {
    const exists = await redis.exists(refreshTokenKey(tokenId));
    logger.debug('[RefreshToken] isValid check', { tokenId: tokenId.slice(0, 8), valid: exists === 1 });
    return exists === 1;
  },

  /**
   * Revoke a specific refresh token
   * Called on logout or token rotation
   */
  async revoke(tokenId: string): Promise<void> {
    logger.debug('[RefreshToken] Revoking token', { tokenId: tokenId.slice(0, 8) });
    // Get the userId first so we can remove from user's set
    const userId = await redis.get(refreshTokenKey(tokenId));

    const pipeline = redis.pipeline();
    pipeline.del(refreshTokenKey(tokenId));

    if (userId) {
      pipeline.srem(userRefreshTokensKey(userId), tokenId);
    }

    await pipeline.exec();
  },

  /**
   * Revoke all refresh tokens for a user
   * Called on password change, account compromise, or "logout all devices"
   */
  async revokeAllForUser(userId: string): Promise<void> {
    logger.debug('[RefreshToken] Revoking all tokens for user', { userId: userId.slice(0, 8) });
    const userKey = userRefreshTokensKey(userId);

    // Get all token IDs for this user
    const tokenIds = await redis.smembers(userKey);

    if (tokenIds.length === 0) {
      logger.debug('[RefreshToken] No tokens to revoke', { userId: userId.slice(0, 8) });
      return;
    }

    logger.debug('[RefreshToken] Revoking tokens', { userId: userId.slice(0, 8), count: tokenIds.length });

    // Build keys to delete
    const keysToDelete = tokenIds.map(refreshTokenKey);
    keysToDelete.push(userKey); // Also delete the user's set

    // Delete all in one operation
    await redis.del(...keysToDelete);
  },

  /**
   * Get count of active refresh tokens for a user
   * Useful for showing "active sessions" count
   */
  async getActiveCount(userId: string): Promise<number> {
    return redis.scard(userRefreshTokensKey(userId));
  },
};

// ============================================
// Pending OAuth Signup (consent required)
// ============================================

const OAUTH_CONSENT_TTL = 600; // 10 minutes

function oauthConsentKey(token: string): string {
  return `oauth:consent:${token}`;
}

export const oauthConsentStore = {
  /**
   * Store pending OAuth signup data while awaiting consent
   */
  async store(data: Record<string, unknown>): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    await redis.setex(oauthConsentKey(token), OAUTH_CONSENT_TTL, JSON.stringify(data));
    return token;
  },

  /**
   * Retrieve and delete pending OAuth signup data (one-time use).
   * Uses atomic Lua script to prevent race conditions where
   * concurrent requests could both consume the same token.
   */
  async consume(token: string): Promise<Record<string, unknown> | null> {
    const key = oauthConsentKey(token);
    const data = await redis.eval(
      'local v = redis.call("GET", KEYS[1]) if v then redis.call("DEL", KEYS[1]) end return v',
      1,
      key,
    ) as string | null;
    if (!data) return null;
    return JSON.parse(data);
  },
};
