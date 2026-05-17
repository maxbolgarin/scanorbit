import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createChain } from '../../helpers/mockDb.js';

let selectResult: unknown[] = [];
let insertResult: unknown[] = [];
let updateResult: unknown[] = [];

vi.mock('../../../lib/db.js', () => ({
  db: {
    select: vi.fn(() => createChain(selectResult)),
    insert: vi.fn(() => createChain(insertResult)),
    update: vi.fn(() => createChain(updateResult)),
    delete: vi.fn(() => createChain([])),
    transaction: vi.fn(),
  },
  pool: {},
}));

vi.mock('../../../lib/redis.js', () => ({
  redis: { on: vi.fn(), eval: vi.fn(), set: vi.fn().mockResolvedValue('OK') },
  accountLockoutStore: {
    checkLockout: vi.fn().mockResolvedValue({ locked: false }),
    recordFailedAttempt: vi.fn().mockResolvedValue(undefined),
    clearLockout: vi.fn().mockResolvedValue(undefined),
  },
  signupCodes: {
    checkResendCooldown: vi.fn().mockResolvedValue({ allowed: true }),
    setCode: vi.fn().mockResolvedValue(undefined),
    setResendCooldown: vi.fn().mockResolvedValue(undefined),
    getCode: vi.fn().mockResolvedValue('123456'),
    deleteCode: vi.fn().mockResolvedValue(undefined),
    checkAttempts: vi.fn().mockResolvedValue({ allowed: true, attemptsRemaining: 5 }),
    checkAndIncrementAttempts: vi.fn().mockResolvedValue({ allowed: true, attemptsRemaining: 4 }),
    incrementAttempts: vi.fn().mockResolvedValue(undefined),
    resetAttempts: vi.fn().mockResolvedValue(undefined),
    cleanup: vi.fn().mockResolvedValue(undefined),
  },
  twoFactorStore: {
    createChallenge: vi.fn().mockResolvedValue('challenge-token-123'),
    getChallenge: vi.fn().mockResolvedValue(null),
  },
  refreshTokenStore: {
    store: vi.fn().mockResolvedValue(undefined),
    revokeAllForUser: vi.fn().mockResolvedValue(undefined),
  },
  passwordResetStore: {
    setToken: vi.fn().mockResolvedValue(undefined),
    getToken: vi.fn().mockResolvedValue(null),
    deleteToken: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../../lib/jwt.js', () => ({
  jwt: {
    signAccessToken: vi.fn().mockResolvedValue('access-token'),
    signRefreshToken: vi.fn().mockResolvedValue({ token: 'refresh-token', tokenId: 'tid-1' }),
    signSignupToken: vi.fn().mockResolvedValue('signup-token'),
    verifySignupToken: vi.fn().mockResolvedValue({ email: 'user@test.com', type: 'signup' as const }),
    verifyRefreshToken: vi.fn().mockResolvedValue({ userId: 'user-1', tokenId: 'tid-1', type: 'refresh' as const }),
  },
}));

vi.mock('../../../services/emailService.js', () => ({
  emailService: {
    sendVerificationEmail: vi.fn().mockResolvedValue({ success: true }),
    sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../../lib/metrics.js', () => ({
  authOperationsTotal: { inc: vi.fn() },
}));

vi.mock('../../../lib/config.js', () => ({
  config: {
    frontendUrl: 'http://localhost:3000',
    oauthEncryptionKey: 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
    google: { clientId: 'test', clientSecret: 'test', callbackUrl: 'http://localhost:3000/auth/google/callback' },
    github: { clientId: 'test', clientSecret: 'test', callbackUrl: 'http://localhost:3000/auth/github/callback' },
  },
}));

vi.mock('../../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../lib/crypto.js', () => ({
  encryptOAuthTokenOptional: vi.fn().mockReturnValue('encrypted-token'),
}));

vi.mock('google-auth-library', () => {
  class MockOAuth2Client {
    verifyIdToken = vi.fn().mockResolvedValue({
      getPayload: () => ({ sub: 'google-123', email: 'user@test.com', name: 'Test', email_verified: true }),
    });
    generateAuthUrl = vi.fn().mockReturnValue('https://accounts.google.com/o/oauth2/auth');
    getToken = vi.fn().mockResolvedValue({ tokens: { id_token: 'mock-token' } });
  }
  return { OAuth2Client: MockOAuth2Client };
});

import { authService } from '../../../services/auth/index.js';

describe('authService - oauth', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    selectResult = [];
    insertResult = [];
    updateResult = [];
    const { db } = await import('../../../lib/db.js');
    vi.mocked(db.select).mockImplementation(() => createChain(selectResult) as any);
    vi.mocked(db.insert).mockImplementation(() => createChain(insertResult) as any);
    vi.mocked(db.update).mockImplementation(() => createChain(updateResult) as any);
  });

  describe('generateOAuthState', () => {
    it('returns a state string', async () => {
      const { redis: mockRedis } = await import('../../../lib/redis.js');
      vi.mocked(mockRedis as any).set = vi.fn().mockResolvedValue('OK');
      const state = await authService.generateOAuthState();
      expect(state).toBeTruthy();
      expect(typeof state).toBe('string');
    });
  });

  describe('verifyOAuthState', () => {
    it('returns true for valid state', async () => {
      const { redis: mockRedis } = await import('../../../lib/redis.js');
      vi.mocked(mockRedis as any).eval = vi.fn().mockResolvedValue('1');
      const result = await authService.verifyOAuthState('valid-state');
      expect(result).toBe(true);
    });

    it('returns false for invalid state', async () => {
      const { redis: mockRedis } = await import('../../../lib/redis.js');
      vi.mocked(mockRedis as any).eval = vi.fn().mockResolvedValue(null);
      const result = await authService.verifyOAuthState('invalid-state');
      expect(result).toBe(false);
    });
  });

  describe('getGoogleAuthUrl', () => {
    it('returns a URL string', () => {
      const url = authService.getGoogleAuthUrl('test-state');
      expect(url).toContain('https://accounts.google.com');
    });
  });
});
