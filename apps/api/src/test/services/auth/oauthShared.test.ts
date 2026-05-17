import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createChain } from '../../helpers/mockDb.js';

let insertResult: unknown[] = [];

vi.mock('../../../lib/db.js', () => ({
  db: {
    select: vi.fn(() => createChain([])),
    insert: vi.fn(() => createChain(insertResult)),
    update: vi.fn(() => createChain([])),
    delete: vi.fn(() => createChain([])),
    transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        insert: vi.fn(() => createChain(insertResult)),
        select: vi.fn(() => createChain([])),
        update: vi.fn(() => createChain([])),
      };
      return fn(tx);
    }),
  },
  pool: {},
}));

vi.mock('../../../lib/redis.js', () => ({
  redis: {
    on: vi.fn(),
    set: vi.fn().mockResolvedValue('OK'),
    eval: vi.fn().mockResolvedValue('1'),
    publish: vi.fn().mockResolvedValue(0),
  },
}));

vi.mock('../../../lib/crypto.js', () => ({
  encryptOAuthTokenOptional: vi.fn().mockReturnValue('encrypted-token'),
}));

vi.mock('../../../lib/metrics.js', () => ({
  authOperationsTotal: { inc: vi.fn() },
  userSignupsTotal: { inc: vi.fn() },
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

import { oauthSharedMethods, createGoogleOAuthUser, createGithubOAuthUser } from '../../../services/auth/oauthShared.js';

describe('oauthShared', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    insertResult = [];
    const { db } = await import('../../../lib/db.js');
    vi.mocked(db.insert).mockImplementation(() => createChain(insertResult) as any);
    vi.mocked(db.transaction).mockImplementation(async (fn: any) => {
      const tx = {
        insert: vi.fn(() => createChain(insertResult)),
        select: vi.fn(() => createChain([])),
        update: vi.fn(() => createChain([])),
      };
      return fn(tx);
    });
  });

  describe('generateOAuthState', () => {
    it('returns a hex string', async () => {
      const state = await oauthSharedMethods.generateOAuthState();
      expect(state).toBeTruthy();
      expect(typeof state).toBe('string');
      expect(state).toMatch(/^[a-f0-9]{64}$/);
    });

    it('stores the state in Redis with expiry', async () => {
      const { redis } = await import('../../../lib/redis.js');
      await oauthSharedMethods.generateOAuthState();
      expect(redis.set).toHaveBeenCalledWith(
        expect.stringContaining('oauth_state:'),
        '1',
        'EX',
        600,
      );
    });
  });

  describe('verifyOAuthState', () => {
    it('returns true when Redis eval returns non-null', async () => {
      const { redis } = await import('../../../lib/redis.js');
      vi.mocked(redis.eval).mockResolvedValue('1');
      const result = await oauthSharedMethods.verifyOAuthState('valid-state');
      expect(result).toBe(true);
    });

    it('returns false when Redis eval returns null', async () => {
      const { redis } = await import('../../../lib/redis.js');
      vi.mocked(redis.eval).mockResolvedValue(null);
      const result = await oauthSharedMethods.verifyOAuthState('invalid-state');
      expect(result).toBe(false);
    });

    it('passes correct Lua script for atomic GET+DEL', async () => {
      const { redis } = await import('../../../lib/redis.js');
      await oauthSharedMethods.verifyOAuthState('test-state');
      expect(redis.eval).toHaveBeenCalledWith(
        expect.stringContaining('redis.call("GET"'),
        1,
        'oauth_state:test-state',
      );
    });
  });

  describe('createGoogleOAuthUser', () => {
    it('creates user via a transaction', async () => {
      const newUser = { id: 'user-1', email: 'test@example.com', fullName: 'Test User' };
      insertResult = [newUser];

      const result = await createGoogleOAuthUser({
        googleId: 'g-123',
        email: 'Test@Example.com',
        emailVerified: true,
        fullName: 'Test User',
      });
      expect(result.id).toBe('user-1');
      expect(result.email).toBe('test@example.com');
    });

    it('throws HTTP409Error on duplicate email (code 23505)', async () => {
      const { db } = await import('../../../lib/db.js');

      const dbError = new Error('unique violation') as Error & { cause: { code: string } };
      dbError.cause = { code: '23505' };
      vi.mocked(db.transaction).mockRejectedValue(dbError);

      await expect(createGoogleOAuthUser({
        googleId: 'g-123',
        email: 'dup@example.com',
        emailVerified: true,
      })).rejects.toThrow('An account with this email already exists');
    });
  });

  describe('createGithubOAuthUser', () => {
    it('creates user via a transaction', async () => {
      const newUser = { id: 'user-2', email: 'gh@example.com', fullName: 'GH User' };
      insertResult = [newUser];

      const result = await createGithubOAuthUser({
        githubId: 'gh-456',
        email: 'GH@Example.com',
        emailVerified: true,
        fullName: 'GH User',
      });
      expect(result.id).toBe('user-2');
    });
  });
});
