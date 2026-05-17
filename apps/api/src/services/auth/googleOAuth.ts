import { eq, and } from 'drizzle-orm';
import { db } from '../../lib/db.js';
import { HTTP400Error, HTTP401Error, getPgErrorCode } from '../../lib/errors.js';
import { users, orgs, userOrgMembers, userOauthAccounts } from '../../db/schema.js';
import { twoFactorStore } from '../../lib/redis.js';
import { encryptOAuthTokenOptional } from '../../lib/crypto.js';
import { authOperationsTotal, userLoginsTotal } from '../../lib/metrics.js';
import { config } from '../../lib/config.js';
import { minimizeOAuthProfile, googleClient } from './helpers.js';
import { verifyOAuthState, createGoogleOAuthUser } from './oauthShared.js';
import type { GoogleUserInfo, GoogleAuthResult } from '../../types/index.js';

/**
 * Generate Google OAuth authorization URL
 */
function getGoogleAuthUrl(state: string): string {
  return googleClient.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ],
    state,
    prompt: 'consent',
  });
}

/**
 * Handle Google OAuth callback (authorization code flow)
 */
async function handleGoogleCallback(code: string, state: string): Promise<GoogleAuthResult> {
  // Verify state parameter
  if (!await verifyOAuthState(state)) {
    authOperationsTotal.inc({ operation: 'google_oauth', status: 'invalid_state' });
    throw new HTTP400Error('Invalid OAuth state. Please try again.');
  }

  // Exchange code for tokens
  const { tokens } = await googleClient.getToken(code);
  // Note: Do NOT call googleClient.setCredentials(tokens) — it mutates the shared singleton
  // and verifyIdToken does not need credentials set on the client.

  // Verify and decode ID token
  const ticket = await googleClient.verifyIdToken({
    idToken: tokens.id_token!,
    audience: config.google.clientId,
  });

  const payload = ticket.getPayload();
  if (!payload || !payload.email) {
    authOperationsTotal.inc({ operation: 'google_oauth', status: 'no_email' });
    throw new HTTP400Error('Failed to get user info from Google');
  }

  return processGoogleAuth({
    googleId: payload.sub,
    email: payload.email,
    emailVerified: payload.email_verified ?? false,
    fullName: payload.name,
    picture: payload.picture,
    accessToken: tokens.access_token ?? undefined,
    refreshToken: tokens.refresh_token ?? undefined,
    tokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    rawProfile: minimizeOAuthProfile(payload as unknown as Record<string, unknown>, 'google'),
  });
}

/**
 * Handle Google ID token (frontend-initiated flow with Google Sign-In)
 */
async function handleGoogleIdToken(idToken: string): Promise<GoogleAuthResult> {
  // Verify ID token
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: config.google.clientId,
  });

  const payload = ticket.getPayload();
  if (!payload || !payload.email) {
    authOperationsTotal.inc({ operation: 'google_oauth', status: 'invalid_token' });
    throw new HTTP400Error('Invalid ID token');
  }

  return processGoogleAuth({
    googleId: payload.sub,
    email: payload.email,
    emailVerified: payload.email_verified ?? false,
    fullName: payload.name,
    picture: payload.picture,
    rawProfile: minimizeOAuthProfile(payload as unknown as Record<string, unknown>, 'google'),
  });
}

/**
 * Process Google authentication - create or link user
 */
async function processGoogleAuth(googleUser: GoogleUserInfo): Promise<GoogleAuthResult> {
  const normalizedEmail = googleUser.email.toLowerCase();

  // Check if OAuth account already exists
  const existingOAuth = await db
    .select({ userId: userOauthAccounts.userId })
    .from(userOauthAccounts)
    .where(and(
      eq(userOauthAccounts.provider, 'google'),
      eq(userOauthAccounts.providerUserId, googleUser.googleId)
    ))
    .limit(1);

  if (existingOAuth.length > 0) {
    // Existing OAuth account - just log in
    authOperationsTotal.inc({ operation: 'google_oauth', status: 'existing_oauth' });
    userLoginsTotal.inc({ method: 'google', status: 'success' });
    return completeOAuthLogin(existingOAuth[0].userId, googleUser, false);
  }

  // Check if user exists by email (for account linking)
  const existingUser = await db
    .select({ id: users.id, emailVerified: users.emailVerified })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  if (existingUser.length > 0) {
    // Link Google account to existing user (catch duplicate if concurrent request already linked)
    try {
      await linkGoogleAccount(existingUser[0].id, googleUser);
    } catch (error) {
      if (getPgErrorCode(error) !== '23505') throw error;
      // Already linked by concurrent request, continue to login
    }

    // Mark email as verified if Google says it's verified
    if (googleUser.emailVerified && !existingUser[0].emailVerified) {
      await db
        .update(users)
        .set({ emailVerified: true, updatedAt: new Date() })
        .where(eq(users.id, existingUser[0].id));
    }

    authOperationsTotal.inc({ operation: 'google_oauth', status: 'linked_account' });
    userLoginsTotal.inc({ method: 'google', status: 'success' });
    return completeOAuthLogin(existingUser[0].id, googleUser, false);
  }

  // New user — create directly (self-hosted, no consent gate)
  const newUser = await createGoogleOAuthUser(googleUser);
  return completeOAuthLogin(newUser.id, googleUser, true);
}

/**
 * Link Google account to existing user
 */
async function linkGoogleAccount(userId: string, googleUser: GoogleUserInfo): Promise<void> {
  // Encrypt tokens before storage
  await db.insert(userOauthAccounts).values({
    userId,
    provider: 'google',
    providerUserId: googleUser.googleId,
    providerEmail: googleUser.email,
    accessToken: encryptOAuthTokenOptional(googleUser.accessToken),
    refreshToken: encryptOAuthTokenOptional(googleUser.refreshToken),
    tokenExpiresAt: googleUser.tokenExpiresAt,
    rawProfile: googleUser.rawProfile,
  });
}

/**
 * Complete OAuth login - get user data and issue JWT
 * If 2FA is enabled, returns challenge token instead
 */
async function completeOAuthLogin(
  userId: string,
  _googleUser: GoogleUserInfo,
  isNewUser: boolean
): Promise<GoogleAuthResult> {
  // Get user info
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      twoFactorEnabled: users.twoFactorEnabled,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    throw new HTTP401Error('User not found');
  }

  // Check if 2FA is enabled (not for new users as they can't have 2FA yet)
  if (user.twoFactorEnabled && !isNewUser) {
    const challengeToken = await twoFactorStore.createChallenge(userId);
    authOperationsTotal.inc({ operation: 'google_oauth', status: '2fa_required' });
    userLoginsTotal.inc({ method: 'google', status: '2fa_required' });
    return {
      requires2FA: true,
      challengeToken,
      isNewUser: false,
    };
  }

  // Get user's orgs
  const userOrgs = await db
    .select({
      id: orgs.id,
      name: orgs.name,
      slug: orgs.slug,
    })
    .from(orgs)
    .innerJoin(userOrgMembers, eq(orgs.id, userOrgMembers.orgId))
    .where(eq(userOrgMembers.userId, userId));

  return {
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
    },
    orgs: userOrgs,
    isNewUser,
    hasOrg: userOrgs.length > 0,
  };
}

export const googleOAuthMethods = {
  getGoogleAuthUrl,
  handleGoogleCallback,
  handleGoogleIdToken,
  processGoogleAuth,
  linkGoogleAccount,
  completeOAuthLogin,
};
