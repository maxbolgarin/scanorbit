import * as jose from 'jose';
import crypto from 'crypto';
import { config } from './config.js';

// ============================================
// Token Type Definitions
// ============================================

export interface AccessTokenPayload {
  userId: string;
  orgId: string | null;
  type: 'access';
}

export interface RefreshTokenPayload {
  userId: string;
  tokenId: string;  // Unique ID for revocation tracking
  type: 'refresh';
}

export interface SignupTokenPayload {
  email: string;
  type: 'signup';
}

// ============================================
// Token Configuration
// ============================================

const accessSecret = new TextEncoder().encode(config.jwtSecret);
const refreshSecret = new TextEncoder().encode(config.jwtRefreshSecret);

// Access token: 5 minutes (short-lived for security)
const ACCESS_TOKEN_EXPIRY = '5m';

// Refresh token: 7 days (stored in httpOnly cookie)
const REFRESH_TOKEN_EXPIRY = '7d';

// ============================================
// JWT Operations
// ============================================

export const jwt = {
  // ============================================
  // Access Token Operations (short-lived, 5 min)
  // ============================================

  /**
   * Sign a new access token (5 minutes expiry)
   * Used for API authentication, stored in frontend memory
   */
  async signAccessToken(payload: { userId: string; orgId: string | null }): Promise<string> {
    const tokenPayload: AccessTokenPayload = {
      ...payload,
      type: 'access',
    };

    return new jose.SignJWT(tokenPayload as unknown as jose.JWTPayload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(ACCESS_TOKEN_EXPIRY)
      .sign(accessSecret);
  },

  /**
   * Verify an access token
   * Throws if token is invalid or expired
   */
  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    const { payload } = await jose.jwtVerify(token, accessSecret);

    // Ensure this is an access token
    if (payload.type !== 'access') {
      throw new Error('Invalid token type');
    }

    return {
      userId: payload.userId as string,
      orgId: payload.orgId as string | null,
      type: 'access',
    };
  },

  // ============================================
  // Refresh Token Operations (long-lived, 7 days)
  // ============================================

  /**
   * Sign a new refresh token (7 days expiry)
   * Returns both the token and the tokenId for storage/revocation
   * Stored in httpOnly secure cookie
   */
  async signRefreshToken(userId: string): Promise<{ token: string; tokenId: string }> {
    const tokenId = crypto.randomUUID();

    const tokenPayload: RefreshTokenPayload = {
      userId,
      tokenId,
      type: 'refresh',
    };

    const token = await new jose.SignJWT(tokenPayload as unknown as jose.JWTPayload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(REFRESH_TOKEN_EXPIRY)
      .sign(refreshSecret);

    return { token, tokenId };
  },

  /**
   * Verify a refresh token
   * Throws if token is invalid or expired
   * Note: You must also check if the tokenId is revoked via refreshTokenStore
   */
  async verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
    const { payload } = await jose.jwtVerify(token, refreshSecret);

    // Ensure this is a refresh token
    if (payload.type !== 'refresh') {
      throw new Error('Invalid token type');
    }

    return {
      userId: payload.userId as string,
      tokenId: payload.tokenId as string,
      type: 'refresh',
    };
  },

  // ============================================
  // Signup Token Operations
  // ============================================

  async signSignupToken(email: string): Promise<string> {
    const payload: SignupTokenPayload = { email, type: 'signup' };
    return new jose.SignJWT(payload as unknown as jose.JWTPayload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('30m') // 30 minutes
      .sign(accessSecret);
  },

  async verifySignupToken(token: string): Promise<SignupTokenPayload> {
    const { payload } = await jose.jwtVerify(token, accessSecret);
    if (payload.type !== 'signup') {
      throw new Error('Invalid token type');
    }
    return {
      email: payload.email as string,
      type: 'signup',
    };
  },
};
