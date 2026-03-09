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

const { mockSignupCodes, mockRefreshTokenStore } = vi.hoisted(() => ({
  mockSignupCodes: {
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
  signupCodes: mockSignupCodes,
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
  oauthConsentStore: {
    storeConsentData: vi.fn().mockResolvedValue(undefined),
    getConsentData: vi.fn().mockResolvedValue(null),
    deleteConsentData: vi.fn().mockResolvedValue(undefined),
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

vi.mock('../../../services/consentService.js', () => ({
  consentService: {
    logSignupConsent: vi.fn().mockResolvedValue(undefined),
    logConsent: vi.fn().mockResolvedValue(undefined),
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

describe('authService - verification', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    selectResult = [];
    insertResult = [];
    updateResult = [];
    const { db } = await import('../../../lib/db.js');
    vi.mocked(db.select).mockImplementation(() => createChain(selectResult) as any);
    vi.mocked(db.insert).mockImplementation(() => createChain(insertResult) as any);
    vi.mocked(db.update).mockImplementation(() => createChain(updateResult) as any);
    mockSignupCodes.checkResendCooldown.mockResolvedValue({ allowed: true });
    mockSignupCodes.getCode.mockResolvedValue('123456');
    mockSignupCodes.checkAttempts.mockResolvedValue({ allowed: true, attemptsRemaining: 5 });
    mockSignupCodes.checkAndIncrementAttempts.mockResolvedValue({ allowed: true, attemptsRemaining: 4 });
    const { jwt } = await import('../../../lib/jwt.js');
    vi.mocked(jwt.signSignupToken).mockResolvedValue('signup-token');
  });

  describe('sendVerificationCode', () => {
    it('sends code to new email', async () => {
      selectResult = []; // no existing user
      await expect(authService.sendVerificationCode('new@test.com'))
        .resolves.toEqual({ success: true, message: expect.any(String) });
      expect(mockSignupCodes.setCode).toHaveBeenCalled();
    });

    it('throws 400 for already verified email', async () => {
      selectResult = [{ id: 'user-1', emailVerified: true }];
      await expect(authService.sendVerificationCode('verified@test.com'))
        .rejects.toThrow('already exists');
    });

    it('throws 400 when on cooldown', async () => {
      selectResult = [];
      mockSignupCodes.checkResendCooldown.mockResolvedValue({ allowed: false, waitSeconds: 30 });
      await expect(authService.sendVerificationCode('new@test.com'))
        .rejects.toThrow('Please wait');
    });
  });

  describe('verifySignupCode', () => {
    it('returns signup token on valid code', async () => {
      const result = await authService.verifySignupCode('user@test.com', '123456');
      expect(result.success).toBe(true);
      expect(result.signupToken).toBe('signup-token');
      expect(mockSignupCodes.deleteCode).toHaveBeenCalled();
    });

    it('throws 400 for expired code', async () => {
      mockSignupCodes.getCode.mockResolvedValue(null);
      await expect(authService.verifySignupCode('user@test.com', '123456'))
        .rejects.toThrow('expired');
    });

    it('throws 400 for wrong code', async () => {
      mockSignupCodes.getCode.mockResolvedValue('654321');
      await expect(authService.verifySignupCode('user@test.com', '123456'))
        .rejects.toThrow('Invalid verification code');
    });

    it('throws 400 when rate limited', async () => {
      mockSignupCodes.checkAndIncrementAttempts.mockResolvedValue({ allowed: false, attemptsRemaining: 0 });
      await expect(authService.verifySignupCode('user@test.com', '123456'))
        .rejects.toThrow('Too many attempts');
    });
  });

  describe('verifyEmail', () => {
    it('verifies email with correct code', async () => {
      selectResult = [{
        id: 'user-1',
        emailVerified: false,
        emailVerificationCode: '123456',
        emailVerificationExpiresAt: new Date(Date.now() + 3600000),
      }];

      const result = await authService.verifyEmail('user@test.com', '123456');
      expect(result.success).toBe(true);
    });

    it('returns success for already verified email', async () => {
      selectResult = [{
        id: 'user-1',
        emailVerified: true,
      }];

      const result = await authService.verifyEmail('user@test.com', '000000');
      expect(result.success).toBe(true);
      expect(result.message).toContain('already verified');
    });

    it('throws 400 for expired code', async () => {
      selectResult = [{
        id: 'user-1',
        emailVerified: false,
        emailVerificationCode: '123456',
        emailVerificationExpiresAt: new Date(Date.now() - 3600000),
      }];

      await expect(authService.verifyEmail('user@test.com', '123456'))
        .rejects.toThrow('expired');
    });

    it('throws 400 for wrong code', async () => {
      selectResult = [{
        id: 'user-1',
        emailVerified: false,
        emailVerificationCode: '654321',
        emailVerificationExpiresAt: new Date(Date.now() + 3600000),
      }];

      await expect(authService.verifyEmail('user@test.com', '123456'))
        .rejects.toThrow('Invalid verification code');
    });
  });

  describe('resendSignupCode', () => {
    it('resends code to new email', async () => {
      selectResult = [];
      const result = await authService.resendSignupCode('new@test.com');
      expect(result.success).toBe(true);
      expect(mockSignupCodes.setCode).toHaveBeenCalled();
    });

    it('throws 400 for already verified email', async () => {
      selectResult = [{ id: 'user-1', emailVerified: true }];
      await expect(authService.resendSignupCode('verified@test.com'))
        .rejects.toThrow('already exists');
    });

    it('throws 400 when on cooldown', async () => {
      selectResult = [];
      mockSignupCodes.checkResendCooldown.mockResolvedValue({ allowed: false, waitSeconds: 30 });
      await expect(authService.resendSignupCode('new@test.com'))
        .rejects.toThrow('Please wait');
    });
  });
});
