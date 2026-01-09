import * as jose from 'jose';
import { config } from './config.js';

export interface JWTPayload {
  userId: string;
  orgId: string | null;
}

export interface SignupTokenPayload {
  email: string;
  type: 'signup';
}

const secret = new TextEncoder().encode(config.jwtSecret);

function parseExpiry(expiry: string): number {
  const match = expiry.match(/^(\d+)([dhms])$/);
  if (!match) {
    return 7 * 24 * 60 * 60; // Default 7 days in seconds
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 'd': return value * 24 * 60 * 60;
    case 'h': return value * 60 * 60;
    case 'm': return value * 60;
    case 's': return value;
    default: return 7 * 24 * 60 * 60;
  }
}

export const jwt = {
  async sign(payload: JWTPayload): Promise<string> {
    const expirySeconds = parseExpiry(config.jwtExpiry);

    return new jose.SignJWT(payload as unknown as jose.JWTPayload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(`${expirySeconds}s`)
      .sign(secret);
  },

  async verify(token: string): Promise<JWTPayload> {
    const { payload } = await jose.jwtVerify(token, secret);
    return {
      userId: payload.userId as string,
      orgId: payload.orgId as string | null,
    };
  },

  async signSignupToken(email: string): Promise<string> {
    const payload: SignupTokenPayload = { email, type: 'signup' };
    return new jose.SignJWT(payload as unknown as jose.JWTPayload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('30m') // 30 minutes
      .sign(secret);
  },

  async verifySignupToken(token: string): Promise<SignupTokenPayload> {
    const { payload } = await jose.jwtVerify(token, secret);
    if (payload.type !== 'signup') {
      throw new Error('Invalid token type');
    }
    return {
      email: payload.email as string,
      type: 'signup',
    };
  },
};
