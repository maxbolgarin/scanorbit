import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createChain } from '../../helpers/mockDb.js';

let selectResult: unknown[] = [];
let insertResult: unknown[] = [];
let updateResult: unknown[] = [];
const mockTransaction = vi.fn();

vi.mock('../../../lib/db.js', () => ({
  db: {
    select: vi.fn(() => createChain(selectResult)),
    insert: vi.fn(() => createChain(insertResult)),
    update: vi.fn(() => createChain(updateResult)),
    delete: vi.fn(() => createChain([])),
    transaction: (...args: unknown[]) => mockTransaction(...args),
  },
  pool: {},
}));

const { mockAccountLockoutStore, mockTwoFactorStore, mockRefreshTokenStore } = vi.hoisted(() => ({
  mockAccountLockoutStore: {
    checkLockout: vi.fn().mockResolvedValue({ locked: false }),
    recordFailedAttempt: vi.fn().mockResolvedValue(undefined),
    clearLockout: vi.fn().mockResolvedValue(undefined),
  },
  mockTwoFactorStore: {
    createChallenge: vi.fn().mockResolvedValue('challenge-token-123'),
    getChallenge: vi.fn().mockResolvedValue(null),
  },
  mockRefreshTokenStore: {
    store: vi.fn().mockResolvedValue(undefined),
    revokeAllForUser: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../../lib/redis.js', () => ({
  redis: { on: vi.fn(), eval: vi.fn(), publish: vi.fn().mockResolvedValue(0) },
  accountLockoutStore: mockAccountLockoutStore,
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
  twoFactorStore: mockTwoFactorStore,
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
  userSignupsTotal: { inc: vi.fn() },
  userLoginsTotal: { inc: vi.fn() },
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

describe('authService - core', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    selectResult = [];
    insertResult = [];
    updateResult = [];
    const { db } = await import('../../../lib/db.js');
    vi.mocked(db.select).mockImplementation(() => createChain(selectResult) as any);
    vi.mocked(db.insert).mockImplementation(() => createChain(insertResult) as any);
    vi.mocked(db.update).mockImplementation(() => createChain(updateResult) as any);
    mockAccountLockoutStore.checkLockout.mockResolvedValue({ locked: false });
    const { jwt } = await import('../../../lib/jwt.js');
    vi.mocked(jwt.verifySignupToken).mockResolvedValue({ email: 'user@test.com', type: 'signup' });
    vi.mocked(jwt.verifyRefreshToken).mockResolvedValue({ userId: 'user-1', tokenId: 'tid-1', type: 'refresh' });
    vi.mocked(jwt.signAccessToken).mockResolvedValue('access-token');
    vi.mocked(jwt.signRefreshToken).mockResolvedValue({ token: 'refresh-token', tokenId: 'tid-1' });
    vi.mocked(jwt.signSignupToken).mockResolvedValue('signup-token');
  });

  describe('login', () => {
    it('returns user and orgs on successful login', async () => {
      const bcrypt = await import('bcrypt');
      const hash = await bcrypt.hash('password123', 10);

      let callCount = 0;
      const { db } = await import('../../../lib/db.js');
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return createChain([{
            id: 'user-1',
            email: 'user@test.com',
            fullName: 'Test User',
            passwordHash: hash,
            emailVerified: true,
            twoFactorEnabled: false,
          }]) as any;
        }
        return createChain([{ id: 'org-1', name: 'Test Org', slug: 'test' }]) as any;
      });

      const result = await authService.login('user@test.com', 'password123');
      expect(result).toHaveProperty('user');
      expect((result as any).user.email).toBe('user@test.com');
      expect(mockAccountLockoutStore.clearLockout).toHaveBeenCalled();
    });

    it('throws 401 for locked accounts', async () => {
      mockAccountLockoutStore.checkLockout.mockResolvedValue({
        locked: true,
        remainingLockoutSeconds: 300,
      });

      await expect(authService.login('locked@test.com', 'pass'))
        .rejects.toThrow('Account temporarily locked');
    });

    it('throws 401 for non-existent user', async () => {
      selectResult = [];
      await expect(authService.login('noone@test.com', 'pass'))
        .rejects.toThrow('Invalid credentials');
      expect(mockAccountLockoutStore.recordFailedAttempt).toHaveBeenCalled();
    });

    it('throws 400 for OAuth-only user', async () => {
      selectResult = [{
        id: 'user-1',
        email: 'user@test.com',
        passwordHash: null,
        emailVerified: true,
        twoFactorEnabled: false,
      }];

      await expect(authService.login('user@test.com', 'pass'))
        .rejects.toThrow('social sign-in');
    });

    it('returns 2FA challenge when enabled', async () => {
      const bcrypt = await import('bcrypt');
      const hash = await bcrypt.hash('password123', 10);

      selectResult = [{
        id: 'user-1',
        email: 'user@test.com',
        fullName: 'Test',
        passwordHash: hash,
        emailVerified: true,
        twoFactorEnabled: true,
      }];

      const result = await authService.login('user@test.com', 'password123');
      expect((result as any).requires2FA).toBe(true);
      expect((result as any).challengeToken).toBe('challenge-token-123');
    });
  });

  describe('getMe', () => {
    it('returns user without password hash', async () => {
      let callCount = 0;
      const { db } = await import('../../../lib/db.js');
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return createChain([{
            id: 'user-1',
            email: 'user@test.com',
            fullName: 'Test',
            emailVerified: true,
            twoFactorEnabled: false,
            createdAt: new Date(),
            passwordHash: 'hash',
          }]) as any;
        }
        return createChain([]) as any;
      });

      const result = await authService.getMe('user-1');
      expect(result.user.hasPassword).toBe(true);
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('throws 401 when user not found', async () => {
      selectResult = [];
      await expect(authService.getMe('missing')).rejects.toThrow('User not found');
    });
  });

  describe('switchOrg', () => {
    it('passes for valid membership', async () => {
      selectResult = [{ id: 'mem-1' }];
      await expect(authService.switchOrg('user-1', 'org-1')).resolves.toBeUndefined();
    });

    it('throws 401 for non-member', async () => {
      selectResult = [];
      await expect(authService.switchOrg('user-1', 'org-1'))
        .rejects.toThrow('You do not have access');
    });
  });

  describe('completeSignup', () => {
    it('creates user with verified email', async () => {
      selectResult = []; // no existing user
      insertResult = [{ id: 'user-new', email: 'user@test.com', fullName: '' }];

      const result = await authService.completeSignup('signup-token', 'Password123!');
      expect(result.user.id).toBe('user-new');
    });

    it('throws 400 for invalid signup token', async () => {
      const { jwt } = await import('../../../lib/jwt.js');
      vi.mocked(jwt.verifySignupToken).mockRejectedValue(new Error('Invalid'));

      await expect(authService.completeSignup('bad-token', 'Password123!'))
        .rejects.toThrow('Session expired');
    });

    it('throws 400 when email already registered', async () => {
      selectResult = [{ id: 'existing' }];
      await expect(authService.completeSignup('signup-token', 'Password123!'))
        .rejects.toThrow('Unable to complete registration');
    });
  });

  describe('completeLoginAfter2FA', () => {
    it('returns user and orgs', async () => {
      let callCount = 0;
      const { db } = await import('../../../lib/db.js');
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return createChain([{
            id: 'user-1',
            email: 'user@test.com',
            fullName: 'Test',
            emailVerified: true,
            twoFactorEnabled: true,
          }]) as any;
        }
        return createChain([{ id: 'org-1', name: 'Org', slug: 'org' }]) as any;
      });

      const result = await authService.completeLoginAfter2FA('user-1');
      expect(result.user.id).toBe('user-1');
      expect(result.orgs).toHaveLength(1);
    });

    it('throws 401 when user not found', async () => {
      selectResult = [];
      await expect(authService.completeLoginAfter2FA('missing'))
        .rejects.toThrow('User not found');
    });
  });

  describe('updateProfile', () => {
    it('updates full name', async () => {
      updateResult = [{ id: 'user-1', email: 'user@test.com', fullName: 'New Name' }];

      const result = await authService.updateProfile('user-1', { fullName: 'New Name' });
      expect(result.user.fullName).toBe('New Name');
    });

    it('throws 401 when user not found', async () => {
      updateResult = [];
      await expect(authService.updateProfile('missing', { fullName: 'X' }))
        .rejects.toThrow('User not found');
    });
  });
});
