import { vi } from 'vitest';

export function createMockRedis() {
  const pipeline = {
    setex: vi.fn().mockReturnThis(),
    sadd: vi.fn().mockReturnThis(),
    expire: vi.fn().mockReturnThis(),
    del: vi.fn().mockReturnThis(),
    srem: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([[null, 'OK'], [null, 1], [null, 1]]),
  };

  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    setex: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    exists: vi.fn().mockResolvedValue(0),
    ttl: vi.fn().mockResolvedValue(-1),
    eval: vi.fn().mockResolvedValue(1),
    incr: vi.fn().mockResolvedValue(1),
    llen: vi.fn().mockResolvedValue(0),
    ping: vi.fn().mockResolvedValue('PONG'),
    pipeline: vi.fn().mockReturnValue(pipeline),
    smembers: vi.fn().mockResolvedValue([]),
    scard: vi.fn().mockResolvedValue(0),
    quit: vi.fn().mockResolvedValue('OK'),
    on: vi.fn(),
    status: 'ready',
  };
}

export function createMockSignupCodes() {
  return {
    setCode: vi.fn().mockResolvedValue(undefined),
    getCode: vi.fn().mockResolvedValue(null),
    deleteCode: vi.fn().mockResolvedValue(undefined),
    checkAttempts: vi.fn().mockResolvedValue({ allowed: true, attemptsRemaining: 5 }),
    incrementAttempts: vi.fn().mockResolvedValue(1),
    resetAttempts: vi.fn().mockResolvedValue(undefined),
    checkResendCooldown: vi.fn().mockResolvedValue({ allowed: true, waitSeconds: 0 }),
    setResendCooldown: vi.fn().mockResolvedValue(undefined),
    cleanup: vi.fn().mockResolvedValue(undefined),
  };
}

export function createMockTotpReplayStore() {
  return {
    isCodeUsed: vi.fn().mockResolvedValue(false),
    markCodeUsed: vi.fn().mockResolvedValue(undefined),
  };
}

export function createMockTwoFactorStore() {
  return {
    setSetupSecret: vi.fn().mockResolvedValue(undefined),
    getSetupSecret: vi.fn().mockResolvedValue(null),
    deleteSetupSecret: vi.fn().mockResolvedValue(undefined),
    createChallenge: vi.fn().mockResolvedValue('mock-challenge-token'),
    getChallenge: vi.fn().mockResolvedValue(null),
    deleteChallenge: vi.fn().mockResolvedValue(undefined),
    checkVerifyAttempts: vi.fn().mockResolvedValue({ allowed: true, attemptsRemaining: 5 }),
    incrementVerifyAttempts: vi.fn().mockResolvedValue(1),
    resetVerifyAttempts: vi.fn().mockResolvedValue(undefined),
  };
}

export function createMockAccountLockoutStore() {
  return {
    checkLockout: vi.fn().mockResolvedValue({ locked: false, failedAttempts: 0, remainingLockoutSeconds: 0 }),
    recordFailedAttempt: vi.fn().mockResolvedValue(1),
    clearLockout: vi.fn().mockResolvedValue(undefined),
    getRemainingLockoutTime: vi.fn().mockResolvedValue(0),
  };
}

export function createMockPasswordResetStore() {
  return {
    setToken: vi.fn().mockResolvedValue(undefined),
    getEmail: vi.fn().mockResolvedValue(null),
    deleteToken: vi.fn().mockResolvedValue(undefined),
  };
}

export function createMockRefreshTokenStore() {
  return {
    store: vi.fn().mockResolvedValue(undefined),
    validate: vi.fn().mockResolvedValue(null),
    isValid: vi.fn().mockResolvedValue(true),
    revoke: vi.fn().mockResolvedValue(undefined),
    revokeAllForUser: vi.fn().mockResolvedValue(undefined),
    getActiveCount: vi.fn().mockResolvedValue(1),
  };
}

export function createMockOauthConsentStore() {
  return {
    store: vi.fn().mockResolvedValue('mock-consent-token'),
    consume: vi.fn().mockResolvedValue(null),
  };
}

/**
 * Returns a full redis module mock suitable for vi.mock('../../lib/redis.js', ...)
 */
export function createFullRedisMock() {
  return {
    redis: createMockRedis(),
    signupCodes: createMockSignupCodes(),
    totpReplayStore: createMockTotpReplayStore(),
    twoFactorStore: createMockTwoFactorStore(),
    accountLockoutStore: createMockAccountLockoutStore(),
    passwordResetStore: createMockPasswordResetStore(),
    refreshTokenStore: createMockRefreshTokenStore(),
    oauthConsentStore: createMockOauthConsentStore(),
  };
}
