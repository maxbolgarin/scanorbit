import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSetCookie = vi.fn();

vi.mock('hono/cookie', () => ({
  setCookie: (...args: unknown[]) => mockSetCookie(...args),
}));

vi.mock('../../lib/jwt.js', () => ({
  jwt: {
    signAccessToken: vi.fn().mockResolvedValue('access-token-123'),
    signRefreshToken: vi.fn().mockResolvedValue({ token: 'refresh-token-456', tokenId: 'tid-1' }),
  },
}));

vi.mock('../../lib/redis.js', () => ({
  refreshTokenStore: {
    store: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../lib/config.js', () => ({
  config: {
    cookieDomain: '',
  },
}));

import { setAuthTokens } from '../../lib/authTokens.js';
import { jwt } from '../../lib/jwt.js';
import { refreshTokenStore } from '../../lib/redis.js';

describe('setAuthTokens', () => {
  const mockContext = {} as Parameters<typeof setAuthTokens>[0];

  beforeEach(() => {
    vi.mocked(jwt.signAccessToken).mockResolvedValue('access-token-123');
    vi.mocked(jwt.signRefreshToken).mockResolvedValue({ token: 'refresh-token-456', tokenId: 'tid-1' });
    vi.mocked(refreshTokenStore.store).mockResolvedValue(undefined);
  });

  it('returns access token', async () => {
    const result = await setAuthTokens(mockContext, 'user-1', 'org-1');
    expect(result.accessToken).toBe('access-token-123');
  });

  it('signs access token with userId and orgId', async () => {
    await setAuthTokens(mockContext, 'user-1', 'org-1');
    expect(jwt.signAccessToken).toHaveBeenCalledWith({ userId: 'user-1', orgId: 'org-1' });
  });

  it('signs refresh token with userId', async () => {
    await setAuthTokens(mockContext, 'user-1', null);
    expect(jwt.signRefreshToken).toHaveBeenCalledWith('user-1');
  });

  it('stores refresh token in Redis', async () => {
    await setAuthTokens(mockContext, 'user-1', null);
    expect(refreshTokenStore.store).toHaveBeenCalledWith('tid-1', 'user-1');
  });

  it('sets refresh token cookie', async () => {
    await setAuthTokens(mockContext, 'user-1', null);
    expect(mockSetCookie).toHaveBeenCalledWith(
      mockContext,
      'refresh_token',
      'refresh-token-456',
      expect.objectContaining({
        httpOnly: true,
        path: '/',
      }),
    );
  });

  it('throws when Redis store fails', async () => {
    vi.mocked(refreshTokenStore.store).mockRejectedValue(new Error('Redis down'));
    await expect(setAuthTokens(mockContext, 'user-1', null))
      .rejects.toThrow('Failed to establish session');
  });

  it('does not set cookie when Redis fails', async () => {
    vi.mocked(refreshTokenStore.store).mockRejectedValue(new Error('Redis down'));
    mockSetCookie.mockClear();
    await setAuthTokens(mockContext, 'user-1', null).catch(() => {});
    expect(mockSetCookie).not.toHaveBeenCalled();
  });

  it('handles null orgId', async () => {
    const result = await setAuthTokens(mockContext, 'user-1', null);
    expect(result.accessToken).toBe('access-token-123');
    expect(jwt.signAccessToken).toHaveBeenCalledWith({ userId: 'user-1', orgId: null });
  });

  it('sets cookie with sameSite Lax in non-production', async () => {
    await setAuthTokens(mockContext, 'user-1', null);
    expect(mockSetCookie).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ sameSite: 'Lax', secure: false }),
    );
  });
});
