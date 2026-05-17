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

const { mockRefreshTokenStore } = vi.hoisted(() => ({
  mockRefreshTokenStore: {
    store: vi.fn().mockResolvedValue(undefined),
    revokeAllForUser: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../../lib/redis.js', () => ({
  redis: { on: vi.fn(), eval: vi.fn() },
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
  refreshTokenStore: mockRefreshTokenStore,
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

describe('authService - password', () => {
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

  describe('changePassword', () => {
    it('changes password successfully', async () => {
      const bcrypt = await import('bcrypt');
      const hash = await bcrypt.hash('oldpass123', 10);

      selectResult = [{ id: 'user-1', passwordHash: hash }];

      const result = await authService.changePassword('user-1', 'oldpass123', 'Newpass123!');
      expect(result.success).toBe(true);
      expect(result.message).toContain('changed successfully');
      expect(mockRefreshTokenStore.revokeAllForUser).toHaveBeenCalledWith('user-1');
    });

    it('throws 401 when user not found', async () => {
      selectResult = [];
      await expect(authService.changePassword('missing', 'old', 'new'))
        .rejects.toThrow('User not found');
    });

    it('throws 400 for OAuth-only user', async () => {
      selectResult = [{ id: 'user-1', passwordHash: null }];
      await expect(authService.changePassword('user-1', 'old', 'new'))
        .rejects.toThrow('social sign-in');
    });

    it('throws 400 for wrong current password', async () => {
      const bcrypt = await import('bcrypt');
      const hash = await bcrypt.hash('correctpass', 10);

      selectResult = [{ id: 'user-1', passwordHash: hash }];
      await expect(authService.changePassword('user-1', 'wrongpass', 'newpass'))
        .rejects.toThrow('Current password is incorrect');
    });
  });

  describe('setPassword', () => {
    it('sets password for OAuth-only user', async () => {
      selectResult = [{ id: 'user-1', passwordHash: null }];

      const result = await authService.setPassword('user-1', 'Newpass123!');
      expect(result.success).toBe(true);
      expect(result.message).toContain('set successfully');
    });

    it('throws 401 when user not found', async () => {
      selectResult = [];
      await expect(authService.setPassword('missing', 'pass'))
        .rejects.toThrow('User not found');
    });

    it('throws 400 when user already has password', async () => {
      selectResult = [{ id: 'user-1', passwordHash: '$2b$10$somehash' }];
      await expect(authService.setPassword('user-1', 'pass'))
        .rejects.toThrow('already have a password');
    });
  });
});
