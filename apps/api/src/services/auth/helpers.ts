import crypto, { timingSafeEqual } from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { config } from '../../lib/config.js';
import type { User, Org } from '../../db/schema.js';

/**
 * Minimize raw OAuth profile to only essential fields for GDPR compliance.
 * Strips unnecessary PII (avatar, locale, bio, etc.) from stored profiles.
 */
export function minimizeOAuthProfile(raw: Record<string, unknown>, provider: 'google' | 'github'): Record<string, unknown> {
  if (provider === 'google') {
    return {
      sub: raw.sub,
      email: raw.email,
      email_verified: raw.email_verified,
      name: raw.name,
      iss: raw.iss,
      aud: raw.aud,
    };
  }
  // GitHub
  return {
    id: raw.id,
    login: raw.login,
    email: raw.email,
    name: raw.name,
    type: raw.type,
  };
}

export const SALT_ROUNDS = 10;
export const VERIFICATION_CODE_EXPIRY_HOURS = 2;
export const OAUTH_STATE_EXPIRY_SECONDS = 600; // 10 minutes

// Initialize Google OAuth client
export const googleClient = new OAuth2Client(
  config.google.clientId,
  config.google.clientSecret,
  config.google.callbackUrl
);

// Generate a 6-digit verification code using cryptographically secure random
export function generateVerificationCode(): string {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Constant-time string comparison to prevent timing attacks
 * Used for verification codes to prevent attackers from timing
 * how long comparison takes to narrow down valid codes
 */
export function secureCompare(a: string, b: string): boolean {
  const maxLen = Math.max(a.length, b.length, 1);
  const bufA = Buffer.alloc(maxLen);
  const bufB = Buffer.alloc(maxLen);
  Buffer.from(a, 'utf8').copy(bufA);
  Buffer.from(b, 'utf8').copy(bufB);
  return a.length === b.length && timingSafeEqual(bufA, bufB);
}

// Generate URL-safe slug from org name
export function generateSlug(name: string): string {
  const baseSlug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 50);

  // Add cryptographically random suffix to ensure uniqueness
  const suffix = crypto.randomUUID().substring(0, 8);
  return `${baseSlug}-${suffix}`;
}

export interface SignupResult {
  user: Pick<User, 'id' | 'email' | 'fullName'>;
  org: Pick<Org, 'id' | 'name' | 'slug'> | null;
  message: string;
}

export interface LoginResult {
  requires2FA?: false;
  user: Pick<User, 'id' | 'email' | 'fullName'> & { emailVerified: boolean; twoFactorEnabled: boolean };
  orgs: Pick<Org, 'id' | 'name' | 'slug'>[];
}

export interface LoginResultWith2FA {
  requires2FA: true;
  challengeToken: string;
}

export type LoginResponse = LoginResult | LoginResultWith2FA;
