import crypto from 'crypto';
import { db } from '../../lib/db.js';
import { HTTP409Error, getPgErrorCode } from '../../lib/errors.js';
import { users, userOauthAccounts } from '../../db/schema.js';
import { redis } from '../../lib/redis.js';
import { encryptOAuthTokenOptional } from '../../lib/crypto.js';
import { authOperationsTotal, userSignupsTotal } from '../../lib/metrics.js';
import { OAUTH_STATE_EXPIRY_SECONDS } from './helpers.js';
import type { GoogleUserInfo, GitHubUserInfo } from '../../types/index.js';

/**
 * Generate OAuth state parameter for CSRF protection
 */
async function generateOAuthState(): Promise<string> {
  const state = crypto.randomBytes(32).toString('hex');
  await redis.set(`oauth_state:${state}`, '1', 'EX', OAUTH_STATE_EXPIRY_SECONDS);
  return state;
}

/**
 * Verify OAuth state parameter
 */
export async function verifyOAuthState(state: string): Promise<boolean> {
  // Atomic GET + DEL to prevent concurrent requests from both consuming the same state token (CSRF bypass)
  const key = `oauth_state:${state}`;
  const result = await redis.eval(
    'local v = redis.call("GET", KEYS[1]) if v then redis.call("DEL", KEYS[1]) end return v',
    1,
    key,
  ) as string | null;
  return result !== null;
}

/**
 * Create a new user from a Google OAuth profile.
 */
export async function createGoogleOAuthUser(googleUser: GoogleUserInfo): Promise<{ id: string; email: string; fullName: string | null }> {
  const normalizedEmail = googleUser.email.toLowerCase();

  try {
    const newUser = await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({
          email: normalizedEmail,
          passwordHash: null,
          fullName: googleUser.fullName || '',
          emailVerified: googleUser.emailVerified,
        })
        .returning({ id: users.id, email: users.email, fullName: users.fullName });

      await tx.insert(userOauthAccounts).values({
        userId: user.id,
        provider: 'google',
        providerUserId: googleUser.googleId,
        providerEmail: googleUser.email,
        accessToken: encryptOAuthTokenOptional(googleUser.accessToken),
        refreshToken: encryptOAuthTokenOptional(googleUser.refreshToken),
        tokenExpiresAt: googleUser.tokenExpiresAt ?? null,
        rawProfile: googleUser.rawProfile,
      });

      return user;
    });

    authOperationsTotal.inc({ operation: 'google_oauth', status: 'new_user' });
    userSignupsTotal.inc({ method: 'google' });
    return newUser;
  } catch (error) {
    if (getPgErrorCode(error) === '23505') {
      throw new HTTP409Error('An account with this email already exists. Please sign in instead.');
    }
    throw error;
  }
}

/**
 * Create a new user from a GitHub OAuth profile.
 */
export async function createGithubOAuthUser(githubUser: GitHubUserInfo): Promise<{ id: string; email: string; fullName: string | null }> {
  const normalizedEmail = githubUser.email.toLowerCase();

  try {
    const newUser = await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({
          email: normalizedEmail,
          passwordHash: null,
          fullName: githubUser.fullName || '',
          emailVerified: githubUser.emailVerified,
        })
        .returning({ id: users.id, email: users.email, fullName: users.fullName });

      await tx.insert(userOauthAccounts).values({
        userId: user.id,
        provider: 'github',
        providerUserId: githubUser.githubId,
        providerEmail: githubUser.email,
        accessToken: encryptOAuthTokenOptional(githubUser.accessToken),
        refreshToken: null,
        tokenExpiresAt: null,
        rawProfile: githubUser.rawProfile,
      });

      return user;
    });

    authOperationsTotal.inc({ operation: 'github_oauth', status: 'new_user' });
    userSignupsTotal.inc({ method: 'github' });
    return newUser;
  } catch (error) {
    if (getPgErrorCode(error) === '23505') {
      throw new HTTP409Error('An account with this email already exists. Please sign in instead.');
    }
    throw error;
  }
}

export const oauthSharedMethods = {
  generateOAuthState,
  verifyOAuthState,
};
