import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createChain } from '../../helpers/mockDb.js';

let selectResult: unknown[] = [];
let insertResult: unknown[] = [];

vi.mock('../../../lib/db.js', () => ({
  db: {
    select: vi.fn(() => createChain(selectResult)),
    insert: vi.fn(() => createChain(insertResult)),
    update: vi.fn(() => createChain([])),
    delete: vi.fn(() => createChain([])),
    transaction: vi.fn(),
  },
  pool: {},
}));

vi.mock('../../../lib/redis.js', () => ({
  redis: { on: vi.fn(), eval: vi.fn().mockResolvedValue('1'), set: vi.fn().mockResolvedValue('OK') },
  oauthConsentStore: {
    store: vi.fn().mockResolvedValue('consent-token-123'),
    consume: vi.fn().mockResolvedValue(null),
  },
  twoFactorStore: {
    createChallenge: vi.fn().mockResolvedValue('challenge-token-123'),
  },
}));

vi.mock('../../../lib/crypto.js', () => ({
  encryptOAuthTokenOptional: vi.fn().mockReturnValue('encrypted-token'),
}));

vi.mock('../../../lib/metrics.js', () => ({
  authOperationsTotal: { inc: vi.fn() },
  userLoginsTotal: { inc: vi.fn() },
}));

vi.mock('../../../lib/config.js', () => ({
  config: {
    frontendUrl: 'http://localhost:3000',
    oauthEncryptionKey: 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
    google: { clientId: 'google-client', clientSecret: 'google-secret', callbackUrl: 'http://localhost:3000/auth/google/callback' },
    github: { clientId: 'test', clientSecret: 'test', callbackUrl: 'http://localhost:3000/auth/github/callback' },
  },
}));

vi.mock('../../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../services/consentService.js', () => ({
  consentService: { logConsent: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('google-auth-library', () => {
  class MockOAuth2Client {
    verifyIdToken = vi.fn().mockResolvedValue({
      getPayload: () => ({
        sub: 'google-123',
        email: 'user@test.com',
        name: 'Test User',
        email_verified: true,
        picture: 'https://example.com/photo.jpg',
      }),
    });
    generateAuthUrl = vi.fn().mockReturnValue('https://accounts.google.com/o/oauth2/auth?mock=1');
    getToken = vi.fn().mockResolvedValue({
      tokens: {
        id_token: 'mock-id-token',
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        expiry_date: Date.now() + 3600000,
      },
    });
  }
  return { OAuth2Client: MockOAuth2Client };
});

import { googleOAuthMethods } from '../../../services/auth/googleOAuth.js';

describe('googleOAuth', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    selectResult = [];
    insertResult = [];
    const { db } = await import('../../../lib/db.js');
    vi.mocked(db.select).mockImplementation(() => createChain(selectResult) as any);
    vi.mocked(db.insert).mockImplementation(() => createChain(insertResult) as any);
    vi.mocked(db.update).mockImplementation(() => createChain([]) as any);
  });

  describe('getGoogleAuthUrl', () => {
    it('returns a Google OAuth URL', () => {
      const url = googleOAuthMethods.getGoogleAuthUrl('test-state');
      expect(url).toContain('https://accounts.google.com');
    });
  });

  describe('processGoogleAuth', () => {
    it('returns login result for existing OAuth account', async () => {
      const userId = 'existing-user-id';
      const { db } = await import('../../../lib/db.js');

      let callCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return createChain([{ userId }]) as any;
        }
        if (callCount === 2) {
          return createChain([{ id: userId, email: 'user@test.com', fullName: 'Test', twoFactorEnabled: false }]) as any;
        }
        return createChain([{ id: 'org-1', name: 'Org', slug: 'org' }]) as any;
      });

      const result = await googleOAuthMethods.processGoogleAuth({
        googleId: 'g-123',
        email: 'User@Test.com',
        emailVerified: true,
        fullName: 'Test',
      });

      expect(result).toHaveProperty('user');
      expect((result as any).user.id).toBe(userId);
    });

    it('links account for existing user by email', async () => {
      const { db } = await import('../../../lib/db.js');

      let callCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) return createChain([]) as any; // No OAuth
        if (callCount === 2) return createChain([{ id: 'user-1', emailVerified: false }]) as any; // User by email
        if (callCount === 3) return createChain([{ id: 'user-1', email: 'user@test.com', fullName: 'Test', twoFactorEnabled: false }]) as any;
        return createChain([]) as any;
      });

      const result = await googleOAuthMethods.processGoogleAuth({
        googleId: 'g-123',
        email: 'User@Test.com',
        emailVerified: true,
        fullName: 'Test',
        accessToken: 'tok',
        refreshToken: 'rtok',
        rawProfile: { sub: 'g-123' },
      });

      expect(db.insert).toHaveBeenCalled();
      expect(db.update).toHaveBeenCalled();
    });

    it('ignores duplicate link error (23505) from concurrent request', async () => {
      const { db } = await import('../../../lib/db.js');

      let selectCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCount++;
        if (selectCount === 1) return createChain([]) as any;
        if (selectCount === 2) return createChain([{ id: 'user-1', emailVerified: true }]) as any;
        if (selectCount === 3) return createChain([{ id: 'user-1', email: 'user@test.com', fullName: 'Test', twoFactorEnabled: false }]) as any;
        return createChain([]) as any;
      });

      const dupError = new Error('duplicate') as Error & { cause: { code: string } };
      dupError.cause = { code: '23505' };
      vi.mocked(db.insert).mockImplementation(() => { throw dupError; });

      // Should NOT throw, should continue to login
      const result = await googleOAuthMethods.processGoogleAuth({
        googleId: 'g-123',
        email: 'User@Test.com',
        emailVerified: true,
        fullName: 'Test',
      });

      expect(result).toHaveProperty('user');
    });

    it('rethrows non-duplicate errors from link', async () => {
      const { db } = await import('../../../lib/db.js');

      let selectCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCount++;
        if (selectCount === 1) return createChain([]) as any;
        if (selectCount === 2) return createChain([{ id: 'user-1', emailVerified: true }]) as any;
        return createChain([]) as any;
      });

      vi.mocked(db.insert).mockImplementation(() => { throw new Error('connection error'); });

      await expect(googleOAuthMethods.processGoogleAuth({
        googleId: 'g-123',
        email: 'User@Test.com',
        emailVerified: true,
        fullName: 'Test',
      })).rejects.toThrow('connection error');
    });

    it('requires consent for new user', async () => {
      const { db } = await import('../../../lib/db.js');
      vi.mocked(db.select).mockImplementation(() => createChain([]) as any);

      const result = await googleOAuthMethods.processGoogleAuth({
        googleId: 'g-new',
        email: 'New@Test.com',
        emailVerified: true,
        fullName: 'New User',
      });

      expect(result).toHaveProperty('requiresConsent', true);
      expect(result).toHaveProperty('consentToken');
      expect((result as any).email).toBe('new@test.com');
    });

    it('returns 2FA challenge for existing user with 2FA', async () => {
      const { db } = await import('../../../lib/db.js');

      let callCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) return createChain([{ userId: 'user-2fa' }]) as any;
        if (callCount === 2) return createChain([{ id: 'user-2fa', email: 'user@test.com', fullName: 'Test', twoFactorEnabled: true }]) as any;
        return createChain([]) as any;
      });

      const result = await googleOAuthMethods.processGoogleAuth({
        googleId: 'g-2fa',
        email: 'user@test.com',
        emailVerified: true,
      });

      expect(result).toHaveProperty('requires2FA', true);
      expect(result).toHaveProperty('challengeToken', 'challenge-token-123');
    });
  });

  describe('linkGoogleAccount', () => {
    it('inserts OAuth account with encrypted tokens', async () => {
      const { db } = await import('../../../lib/db.js');
      const { encryptOAuthTokenOptional } = await import('../../../lib/crypto.js');

      await googleOAuthMethods.linkGoogleAccount('user-1', {
        googleId: 'g-123',
        email: 'user@test.com',
        emailVerified: true,
        accessToken: 'access-tok',
        refreshToken: 'refresh-tok',
        tokenExpiresAt: new Date(),
        rawProfile: { sub: 'g-123' },
      });

      expect(db.insert).toHaveBeenCalled();
      expect(encryptOAuthTokenOptional).toHaveBeenCalledWith('access-tok');
      expect(encryptOAuthTokenOptional).toHaveBeenCalledWith('refresh-tok');
    });
  });

  describe('handleGoogleCallback', () => {
    it('throws on invalid OAuth state', async () => {
      const { redis } = await import('../../../lib/redis.js');
      vi.mocked(redis.eval).mockResolvedValue(null);

      await expect(googleOAuthMethods.handleGoogleCallback('code', 'bad-state'))
        .rejects.toThrow('Invalid OAuth state');
    });
  });

  describe('handleGoogleIdToken', () => {
    it('processes a valid ID token', async () => {
      const { db } = await import('../../../lib/db.js');
      // new user path
      vi.mocked(db.select).mockImplementation(() => createChain([]) as any);

      const result = await googleOAuthMethods.handleGoogleIdToken('valid-id-token');
      expect(result).toHaveProperty('requiresConsent', true);
    });
  });

  describe('completeOAuthLogin', () => {
    it('throws when user not found', async () => {
      const { db } = await import('../../../lib/db.js');
      vi.mocked(db.select).mockImplementation(() => createChain([]) as any);

      await expect(
        googleOAuthMethods.completeOAuthLogin('missing-user', {} as any, false),
      ).rejects.toThrow('User not found');
    });
  });
});
