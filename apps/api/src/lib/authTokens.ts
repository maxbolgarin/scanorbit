import { setCookie } from 'hono/cookie';
import { jwt } from './jwt.js';
import { config } from './config.js';
import { refreshTokenStore } from './redis.js';

/**
 * Set refresh token in httpOnly secure cookie
 */
const setRefreshTokenCookie = (c: Parameters<typeof setCookie>[0], refreshToken: string) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const cookieOptions: Parameters<typeof setCookie>[3] = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'None' : 'Lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  };

  if (config.cookieDomain) {
    cookieOptions.domain = config.cookieDomain;
  }

  setCookie(c, 'refresh_token', refreshToken, cookieOptions);
};

/**
 * Issue new access and refresh tokens for a user
 * - Access token (5 min): returned in response body, stored in frontend memory
 * - Refresh token (7 days): stored in httpOnly secure cookie
 *
 * Redis storage MUST succeed before setting the cookie, otherwise user will have
 * a valid JWT but no Redis entry, causing "Token revoked" errors.
 */
export const setAuthTokens = async (
  c: Parameters<typeof setCookie>[0],
  userId: string,
  orgId: string | null
): Promise<{ accessToken: string }> => {
  const accessToken = await jwt.signAccessToken({ userId, orgId });
  const { token: refreshToken, tokenId } = await jwt.signRefreshToken(userId);

  try {
    await refreshTokenStore.store(tokenId, userId);
  } catch (error) {
    throw new Error('Failed to establish session. Please try again.');
  }

  // Only set cookie after Redis storage is confirmed
  setRefreshTokenCookie(c, refreshToken);

  return { accessToken };
};
