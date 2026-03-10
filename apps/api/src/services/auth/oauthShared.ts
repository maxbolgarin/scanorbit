import crypto from 'crypto';
import { db } from '../../lib/db.js';
import { HTTP400Error, HTTP409Error, getPgErrorCode } from '../../lib/errors.js';
import { users, userOauthAccounts } from '../../db/schema.js';
import { redis, oauthConsentStore } from '../../lib/redis.js';
import { consentService } from '../consentService.js';
import { encryptOAuthTokenOptional } from '../../lib/crypto.js';
import { authOperationsTotal } from '../../lib/metrics.js';
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
 * Complete OAuth signup after user gives explicit consent to terms & privacy policy.
 * Called from POST /auth/oauth/complete-signup after the consent UI.
 */
async function completeOAuthSignup(consentToken: string): Promise<{ userId: string; email: string; fullName: string | null; provider: string }> {
  const data = await oauthConsentStore.consume(consentToken);
  if (!data) {
    throw new HTTP400Error('Invalid or expired consent token. Please try signing up again.');
  }

  const provider = data.provider as string;

  if (provider === 'google') {
    const googleUser = data.googleUser as GoogleUserInfo;
    const normalizedEmail = googleUser.email.toLowerCase();

    let newUser;
    try {
      newUser = await db.transaction(async (tx) => {
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
          tokenExpiresAt: googleUser.tokenExpiresAt ? new Date(googleUser.tokenExpiresAt) : null,
          rawProfile: googleUser.rawProfile,
        });

        return user;
      });
    } catch (error) {
      if (getPgErrorCode(error) === '23505') {
        throw new HTTP409Error('An account with this email already exists. Please sign in instead.');
      }
      await oauthConsentStore.restore(consentToken, data);
      throw error;
    }

    try {
      await consentService.logConsent({
        userId: newUser.id,
        email: newUser.email,
        consentType: 'terms_and_privacy',
        consentGiven: true,
        metadata: { source: 'google_oauth', explicit_consent: true },
      });
    } catch {
      // User was created successfully; consent log failure is non-fatal
    }

    authOperationsTotal.inc({ operation: 'google_oauth', status: 'new_user' });
    return { userId: newUser.id, email: newUser.email, fullName: newUser.fullName, provider };
  }

  if (provider === 'github') {
    const githubUser = data.githubUser as GitHubUserInfo;
    const normalizedEmail = githubUser.email.toLowerCase();

    let newUser;
    try {
      newUser = await db.transaction(async (tx) => {
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
    } catch (error) {
      if (getPgErrorCode(error) === '23505') {
        throw new HTTP409Error('An account with this email already exists. Please sign in instead.');
      }
      await oauthConsentStore.restore(consentToken, data);
      throw error;
    }

    try {
      await consentService.logConsent({
        userId: newUser.id,
        email: newUser.email,
        consentType: 'terms_and_privacy',
        consentGiven: true,
        metadata: { source: 'github_oauth', explicit_consent: true },
      });
    } catch {
      // User was created successfully; consent log failure is non-fatal
    }

    authOperationsTotal.inc({ operation: 'github_oauth', status: 'new_user' });
    return { userId: newUser.id, email: newUser.email, fullName: newUser.fullName, provider };
  }

  throw new HTTP400Error('Unknown OAuth provider');
}

export const oauthSharedMethods = {
  generateOAuthState,
  verifyOAuthState,
  completeOAuthSignup,
};
