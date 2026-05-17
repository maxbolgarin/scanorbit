import { describe, it, expect } from 'vitest';
import { jwt } from '../../lib/jwt.js';

describe('jwt', () => {
  describe('access tokens', () => {
    it('signs and verifies an access token', async () => {
      const token = await jwt.signAccessToken({ userId: 'user-1', orgId: 'org-1' });
      expect(typeof token).toBe('string');

      const payload = await jwt.verifyAccessToken(token);
      expect(payload.userId).toBe('user-1');
      expect(payload.orgId).toBe('org-1');
      expect(payload.type).toBe('access');
    });

    it('supports null orgId', async () => {
      const token = await jwt.signAccessToken({ userId: 'user-1', orgId: null });
      const payload = await jwt.verifyAccessToken(token);
      expect(payload.orgId).toBeNull();
    });

    it('rejects tampered token', async () => {
      const token = await jwt.signAccessToken({ userId: 'user-1', orgId: null });
      const tampered = `${token.slice(0, -5)  }XXXXX`;
      await expect(jwt.verifyAccessToken(tampered)).rejects.toThrow();
    });

    it('rejects a refresh token used as access token', async () => {
      const { token } = await jwt.signRefreshToken('user-1');
      // Different signing secrets, so signature verification fails before type check
      await expect(jwt.verifyAccessToken(token)).rejects.toThrow();
    });
  });

  describe('refresh tokens', () => {
    it('signs and verifies a refresh token', async () => {
      const { token, tokenId } = await jwt.signRefreshToken('user-1');
      expect(typeof token).toBe('string');
      expect(typeof tokenId).toBe('string');

      const payload = await jwt.verifyRefreshToken(token);
      expect(payload.userId).toBe('user-1');
      expect(payload.tokenId).toBe(tokenId);
      expect(payload.type).toBe('refresh');
    });

    it('generates unique tokenIds', async () => {
      const r1 = await jwt.signRefreshToken('user-1');
      const r2 = await jwt.signRefreshToken('user-1');
      expect(r1.tokenId).not.toBe(r2.tokenId);
    });

    it('rejects an access token used as refresh token', async () => {
      const token = await jwt.signAccessToken({ userId: 'user-1', orgId: null });
      // Different signing secrets, so signature verification fails before type check
      await expect(jwt.verifyRefreshToken(token)).rejects.toThrow();
    });
  });

  describe('signup tokens', () => {
    it('signs and verifies a signup token', async () => {
      const token = await jwt.signSignupToken('user@example.com');
      const payload = await jwt.verifySignupToken(token);
      expect(payload.email).toBe('user@example.com');
      expect(payload.type).toBe('signup');
    });

    it('rejects an access token used as signup token', async () => {
      const token = await jwt.signAccessToken({ userId: 'user-1', orgId: null });
      await expect(jwt.verifySignupToken(token)).rejects.toThrow('Invalid token type');
    });
  });
});
