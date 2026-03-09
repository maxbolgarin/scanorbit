import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createChain } from '../helpers/mockDb.js';

let selectResult: unknown[] = [];
let insertResult: unknown[] = [];
let updateResult: unknown[] = [];
const mockTransaction = vi.fn();

vi.mock('../../lib/db.js', () => ({
  db: {
    select: vi.fn(() => createChain(selectResult)),
    insert: vi.fn(() => createChain(insertResult)),
    update: vi.fn(() => createChain(updateResult)),
    delete: vi.fn(() => createChain([])),
    transaction: (...args: unknown[]) => mockTransaction(...args),
  },
  pool: {},
}));

const { mockAccountLockoutStore, mockSignupCodes, mockTwoFactorStore, mockRefreshTokenStore } = vi.hoisted(() => ({
  mockAccountLockoutStore: {
    checkLockout: vi.fn().mockResolvedValue({ locked: false }),
    recordFailedAttempt: vi.fn().mockResolvedValue(undefined),
    clearLockout: vi.fn().mockResolvedValue(undefined),
  },
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
  mockTwoFactorStore: {
    createChallenge: vi.fn().mockResolvedValue('challenge-token-123'),
    getChallenge: vi.fn().mockResolvedValue(null),
  },
  mockRefreshTokenStore: {
    store: vi.fn().mockResolvedValue(undefined),
    revokeAllForUser: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../lib/redis.js', () => ({
  redis: { on: vi.fn(), eval: vi.fn() },
  accountLockoutStore: mockAccountLockoutStore,
  signupCodes: mockSignupCodes,
  twoFactorStore: mockTwoFactorStore,
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

vi.mock('../../lib/jwt.js', () => ({
  jwt: {
    signAccessToken: vi.fn().mockResolvedValue('access-token'),
    signRefreshToken: vi.fn().mockResolvedValue('refresh-token'),
    signSignupToken: vi.fn().mockResolvedValue('signup-token'),
    verifySignupToken: vi.fn().mockResolvedValue({ email: 'user@test.com' }),
    verifyRefreshToken: vi.fn().mockResolvedValue({ userId: 'user-1', tokenId: 'tid-1' }),
  },
}));

vi.mock('../../services/emailService.js', () => ({
  emailService: {
    sendVerificationEmail: vi.fn().mockResolvedValue({ success: true }),
    sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../services/consentService.js', () => ({
  consentService: {
    logSignupConsent: vi.fn().mockResolvedValue(undefined),
    logConsent: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../lib/metrics.js', () => ({
  authOperationsTotal: { inc: vi.fn() },
}));

vi.mock('../../lib/config.js', () => ({
  config: {
    frontendUrl: 'http://localhost:3000',
    oauthEncryptionKey: 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
    google: { clientId: 'test', clientSecret: 'test', callbackUrl: 'http://localhost:3000/auth/google/callback' },
    github: { clientId: 'test', clientSecret: 'test', callbackUrl: 'http://localhost:3000/auth/github/callback' },
  },
}));

vi.mock('../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../lib/crypto.js', () => ({
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

import { authService } from '../../services/authService.js';

describe('authService', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    selectResult = [];
    insertResult = [];
    updateResult = [];
    const { db } = await import('../../lib/db.js');
    vi.mocked(db.select).mockImplementation(() => createChain(selectResult) as any);
    vi.mocked(db.insert).mockImplementation(() => createChain(insertResult) as any);
    vi.mocked(db.update).mockImplementation(() => createChain(updateResult) as any);
    mockAccountLockoutStore.checkLockout.mockResolvedValue({ locked: false });
    mockSignupCodes.checkResendCooldown.mockResolvedValue({ allowed: true });
    mockSignupCodes.getCode.mockResolvedValue('123456');
    mockSignupCodes.checkAttempts.mockResolvedValue({ allowed: true, attemptsRemaining: 5 });
    mockSignupCodes.checkAndIncrementAttempts.mockResolvedValue({ allowed: true, attemptsRemaining: 4 });
    const { jwt } = await import('../../lib/jwt.js');
    vi.mocked(jwt.verifySignupToken).mockResolvedValue({ email: 'user@test.com' });
    vi.mocked(jwt.verifyRefreshToken).mockResolvedValue({ userId: 'user-1', tokenId: 'tid-1' });
    vi.mocked(jwt.signAccessToken).mockResolvedValue('access-token');
    vi.mocked(jwt.signRefreshToken).mockResolvedValue('refresh-token');
    vi.mocked(jwt.signSignupToken).mockResolvedValue('signup-token');
  });

  describe('login', () => {
    it('returns user and orgs on successful login', async () => {
      // bcrypt.compare needs real hash
      const bcrypt = await import('bcrypt');
      const hash = await bcrypt.hash('password123', 10);

      let callCount = 0;
      const { db } = await import('../../lib/db.js');
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
      const { db } = await import('../../lib/db.js');
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

  describe('completeSignup', () => {
    it('creates user with verified email', async () => {
      selectResult = []; // no existing user
      insertResult = [{ id: 'user-new', email: 'user@test.com', fullName: '' }];

      const result = await authService.completeSignup('signup-token', 'Password123!');
      expect(result.user.id).toBe('user-new');
    });

    it('throws 400 for invalid signup token', async () => {
      const { jwt } = await import('../../lib/jwt.js');
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

  describe('completeLoginAfter2FA', () => {
    it('returns user and orgs', async () => {
      let callCount = 0;
      const { db } = await import('../../lib/db.js');
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

  describe('updateProfile', () => {
    it('updates full name', async () => {
      let callCount = 0;
      const { db } = await import('../../lib/db.js');
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Subscription check - no active subscription
          return createChain([]) as any;
        }
        return createChain([]) as any;
      });
      updateResult = [{ id: 'user-1', email: 'user@test.com', fullName: 'New Name' }];

      const result = await authService.updateProfile('user-1', { fullName: 'New Name' });
      expect(result.user.fullName).toBe('New Name');
    });

    it('throws 400 when user has active subscription', async () => {
      selectResult = [{ subscriptionStatus: 'active' }];
      await expect(authService.updateProfile('user-1', { fullName: 'New Name' }))
        .rejects.toThrow('active subscription');
    });

    it('throws 401 when user not found', async () => {
      selectResult = [];
      updateResult = [];
      await expect(authService.updateProfile('missing', { fullName: 'X' }))
        .rejects.toThrow('User not found');
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

  describe('generateOAuthState', () => {
    it('returns a state string', async () => {
      const { redis: mockRedis } = await import('../../lib/redis.js');
      vi.mocked(mockRedis as any).set = vi.fn().mockResolvedValue('OK');
      const state = await authService.generateOAuthState();
      expect(state).toBeTruthy();
      expect(typeof state).toBe('string');
    });
  });

  describe('verifyOAuthState', () => {
    it('returns true for valid state', async () => {
      const { redis: mockRedis } = await import('../../lib/redis.js');
      vi.mocked(mockRedis as any).eval = vi.fn().mockResolvedValue('1');
      const result = await authService.verifyOAuthState('valid-state');
      expect(result).toBe(true);
    });

    it('returns false for invalid state', async () => {
      const { redis: mockRedis } = await import('../../lib/redis.js');
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
