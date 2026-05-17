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
    google: { clientId: 'test', clientSecret: 'test', callbackUrl: 'http://localhost:3000/auth/google/callback' },
    github: { clientId: 'gh-client', clientSecret: 'gh-secret', callbackUrl: 'http://localhost:3000/auth/github/callback' },
  },
}));

vi.mock('../../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('google-auth-library', () => {
  class MockOAuth2Client {
    verifyIdToken = vi.fn();
    generateAuthUrl = vi.fn();
    getToken = vi.fn();
  }
  return { OAuth2Client: MockOAuth2Client };
});

import { githubOAuthMethods } from '../../../services/auth/githubOAuth.js';

describe('githubOAuth', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    selectResult = [];
    insertResult = [];
    const { db } = await import('../../../lib/db.js');
    vi.mocked(db.select).mockImplementation(() => createChain(selectResult) as any);
    vi.mocked(db.insert).mockImplementation(() => createChain(insertResult) as any);
    vi.mocked(db.update).mockImplementation(() => createChain([]) as any);
  });

  describe('getGithubAuthUrl', () => {
    it('returns a GitHub OAuth URL with state param', () => {
      const url = githubOAuthMethods.getGithubAuthUrl('test-state');
      expect(url).toContain('https://github.com/login/oauth/authorize');
      expect(url).toContain('state=test-state');
      expect(url).toContain('client_id=gh-client');
      expect(url).toContain('scope=user%3Aemail');
    });
  });

  describe('processGithubAuth', () => {
    it('returns login result for existing OAuth account', async () => {
      const userId = 'existing-user-id';
      // First select: existing OAuth account
      selectResult = [{ userId }];
      const { db } = await import('../../../lib/db.js');

      let callCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // OAuth lookup
          return createChain([{ userId }]) as any;
        }
        if (callCount === 2) {
          // User info
          return createChain([{ id: userId, email: 'user@test.com', fullName: 'Test', twoFactorEnabled: false }]) as any;
        }
        // User orgs
        return createChain([{ id: 'org-1', name: 'Org', slug: 'org' }]) as any;
      });

      const result = await githubOAuthMethods.processGithubAuth({
        githubId: 'gh-123',
        email: 'User@Test.com',
        emailVerified: true,
        fullName: 'Test',
        accessToken: 'tok',
        rawProfile: { id: 123 },
      });

      expect(result).toHaveProperty('user');
      expect((result as any).user.email).toBe('user@test.com');
    });

    it('links account for existing user by email', async () => {
      const { db } = await import('../../../lib/db.js');

      let callCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // No existing OAuth
          return createChain([]) as any;
        }
        if (callCount === 2) {
          // Existing user by email
          return createChain([{ id: 'user-1', emailVerified: false }]) as any;
        }
        if (callCount === 3) {
          // User info for completeGithubOAuthLogin
          return createChain([{ id: 'user-1', email: 'user@test.com', fullName: 'Test', twoFactorEnabled: false }]) as any;
        }
        return createChain([]) as any;
      });

      const result = await githubOAuthMethods.processGithubAuth({
        githubId: 'gh-123',
        email: 'User@Test.com',
        emailVerified: true,
        fullName: 'Test',
        accessToken: 'tok',
        rawProfile: { id: 123 },
      });

      expect(db.insert).toHaveBeenCalled(); // linkGithubAccount
      expect(db.update).toHaveBeenCalled(); // mark email verified
    });

    it('returns 2FA challenge when user has 2FA enabled', async () => {
      const { db } = await import('../../../lib/db.js');

      let callCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return createChain([{ userId: 'user-2fa' }]) as any;
        }
        if (callCount === 2) {
          return createChain([{ id: 'user-2fa', email: 'user@test.com', fullName: 'Test', twoFactorEnabled: true }]) as any;
        }
        return createChain([]) as any;
      });

      const result = await githubOAuthMethods.processGithubAuth({
        githubId: 'gh-2fa',
        email: 'user@test.com',
        emailVerified: true,
        fullName: 'Test',
        accessToken: 'tok',
        rawProfile: { id: 100 },
      });

      expect(result).toHaveProperty('requires2FA', true);
      expect(result).toHaveProperty('challengeToken', 'challenge-token-123');
    });
  });

  describe('linkGithubAccount', () => {
    it('inserts OAuth account with encrypted token', async () => {
      const { db } = await import('../../../lib/db.js');
      const { encryptOAuthTokenOptional } = await import('../../../lib/crypto.js');

      await githubOAuthMethods.linkGithubAccount('user-1', {
        githubId: 'gh-123',
        email: 'user@test.com',
        emailVerified: true,
        accessToken: 'raw-token',
        rawProfile: { id: 123 },
      });

      expect(db.insert).toHaveBeenCalled();
      expect(encryptOAuthTokenOptional).toHaveBeenCalledWith('raw-token');
    });
  });

  describe('handleGithubCallback', () => {
    it('throws on invalid OAuth state', async () => {
      const { redis } = await import('../../../lib/redis.js');
      vi.mocked(redis.eval).mockResolvedValue(null);

      await expect(githubOAuthMethods.handleGithubCallback('code', 'bad-state'))
        .rejects.toThrow('Invalid OAuth state');
    });

    it('throws when GitHub returns token error', async () => {
      const { redis } = await import('../../../lib/redis.js');
      vi.mocked(redis.eval).mockResolvedValue('1');

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'bad_code', error_description: 'Code expired' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      await expect(githubOAuthMethods.handleGithubCallback('bad-code', 'state'))
        .rejects.toThrow('Code expired');

      vi.mocked(globalThis.fetch).mockRestore();
    });

    it('throws when user profile fetch fails', async () => {
      const { redis } = await import('../../../lib/redis.js');
      vi.mocked(redis.eval).mockResolvedValue('1');

      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ access_token: 'tok' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
        .mockResolvedValueOnce(new Response('', { status: 401 }));

      await expect(githubOAuthMethods.handleGithubCallback('code', 'state'))
        .rejects.toThrow('Failed to get user info from GitHub');

      vi.mocked(globalThis.fetch).mockRestore();
    });

    it('throws when no email is available', async () => {
      const { redis } = await import('../../../lib/redis.js');
      vi.mocked(redis.eval).mockResolvedValue('1');

      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ access_token: 'tok' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ id: 1, login: 'test', name: 'Test' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify([]), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );

      await expect(githubOAuthMethods.handleGithubCallback('code', 'state'))
        .rejects.toThrow('No email address associated with your GitHub account');

      vi.mocked(globalThis.fetch).mockRestore();
    });
  });

  describe('completeGithubOAuthLogin', () => {
    it('throws when user not found', async () => {
      const { db } = await import('../../../lib/db.js');
      vi.mocked(db.select).mockImplementation(() => createChain([]) as any);

      await expect(
        githubOAuthMethods.completeGithubOAuthLogin('missing-user', {} as any, false),
      ).rejects.toThrow('User not found');
    });
  });
});
