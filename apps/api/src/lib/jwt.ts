import * as jose from 'jose';
import { config } from './config.js';

export interface JWTPayload {
  userId: string;
  orgId: string | null;
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
};
