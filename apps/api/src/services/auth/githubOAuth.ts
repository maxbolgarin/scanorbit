import { eq, and } from 'drizzle-orm';
import { db } from '../../lib/db.js';
import { HTTP400Error, HTTP401Error, getPgErrorCode } from '../../lib/errors.js';
import { users, orgs, userOrgMembers, userOauthAccounts } from '../../db/schema.js';
import { twoFactorStore } from '../../lib/redis.js';
import { encryptOAuthTokenOptional } from '../../lib/crypto.js';
import { authOperationsTotal, userLoginsTotal } from '../../lib/metrics.js';
import { config } from '../../lib/config.js';
import { minimizeOAuthProfile } from './helpers.js';
import { verifyOAuthState, createGithubOAuthUser } from './oauthShared.js';
import type { GitHubUserInfo, GitHubAuthResult } from '../../types/index.js';

/**
 * Generate GitHub OAuth authorization URL
 */
function getGithubAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: config.github.clientId,
    redirect_uri: config.github.callbackUrl,
    scope: 'user:email',
    state,
  });
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

/**
 * Handle GitHub OAuth callback
 */
async function handleGithubCallback(code: string, state: string): Promise<GitHubAuthResult> {
  // Verify state parameter
  if (!await verifyOAuthState(state)) {
    authOperationsTotal.inc({ operation: 'github_oauth', status: 'invalid_state' });
    throw new HTTP400Error('Invalid OAuth state. Please try again.');
  }

  // Exchange code for access token
  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: config.github.clientId,
      client_secret: config.github.clientSecret,
      code,
    }),
  });

  const tokenData = await tokenResponse.json() as { access_token?: string; error?: string; error_description?: string };

  if (tokenData.error || !tokenData.access_token) {
    authOperationsTotal.inc({ operation: 'github_oauth', status: 'token_error' });
    throw new HTTP400Error(tokenData.error_description || 'Failed to get access token from GitHub');
  }

  const accessToken = tokenData.access_token;

  // Fetch user profile
  const userResponse = await fetch('https://api.github.com/user', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/vnd.github.v3+json',
    },
  });

  if (!userResponse.ok) {
    authOperationsTotal.inc({ operation: 'github_oauth', status: 'user_fetch_error' });
    throw new HTTP400Error('Failed to get user info from GitHub');
  }

  const userData = await userResponse.json() as {
    id: number;
    login: string;
    name?: string;
    email?: string;
    avatar_url?: string;
  };

  // Fetch user emails (needed if primary email is private)
  let email = userData.email;
  let emailVerified = false;

  if (!email) {
    const emailsResponse = await fetch('https://api.github.com/user/emails', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (emailsResponse.ok) {
      const emails = await emailsResponse.json() as Array<{
        email: string;
        primary: boolean;
        verified: boolean;
      }>;

      // Find primary verified email
      const primaryEmail = emails.find(e => e.primary && e.verified);
      if (primaryEmail) {
        email = primaryEmail.email;
        emailVerified = primaryEmail.verified;
      } else {
        // Fallback to any verified email
        const verifiedEmail = emails.find(e => e.verified);
        if (verifiedEmail) {
          email = verifiedEmail.email;
          emailVerified = verifiedEmail.verified;
        }
      }
    }
  } else {
    // If email was in profile, assume it's verified (GitHub only shows verified emails in profile)
    emailVerified = true;
  }

  if (!email) {
    authOperationsTotal.inc({ operation: 'github_oauth', status: 'no_email' });
    throw new HTTP400Error('No email address associated with your GitHub account. Please add a verified email to your GitHub account.');
  }

  return processGithubAuth({
    githubId: userData.id.toString(),
    email,
    emailVerified,
    fullName: userData.name,
    picture: userData.avatar_url,
    username: userData.login,
    accessToken,
    rawProfile: minimizeOAuthProfile(userData as unknown as Record<string, unknown>, 'github'),
  });
}

/**
 * Process GitHub authentication - create or link user
 */
async function processGithubAuth(githubUser: GitHubUserInfo): Promise<GitHubAuthResult> {
  const normalizedEmail = githubUser.email.toLowerCase();

  // Check if OAuth account already exists
  const existingOAuth = await db
    .select({ userId: userOauthAccounts.userId })
    .from(userOauthAccounts)
    .where(and(
      eq(userOauthAccounts.provider, 'github'),
      eq(userOauthAccounts.providerUserId, githubUser.githubId)
    ))
    .limit(1);

  if (existingOAuth.length > 0) {
    // Existing OAuth account - just log in
    authOperationsTotal.inc({ operation: 'github_oauth', status: 'existing_oauth' });
    userLoginsTotal.inc({ method: 'github', status: 'success' });
    return completeGithubOAuthLogin(existingOAuth[0].userId, githubUser, false);
  }

  // Check if user exists by email (for account linking)
  const existingUser = await db
    .select({ id: users.id, emailVerified: users.emailVerified })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  if (existingUser.length > 0) {
    // Link GitHub account to existing user (catch duplicate if concurrent request already linked)
    try {
      await linkGithubAccount(existingUser[0].id, githubUser);
    } catch (error) {
      if (getPgErrorCode(error) !== '23505') throw error;
      // Already linked by concurrent request, continue to login
    }

    // Mark email as verified if GitHub says it's verified
    if (githubUser.emailVerified && !existingUser[0].emailVerified) {
      await db
        .update(users)
        .set({ emailVerified: true, updatedAt: new Date() })
        .where(eq(users.id, existingUser[0].id));
    }

    authOperationsTotal.inc({ operation: 'github_oauth', status: 'linked_account' });
    userLoginsTotal.inc({ method: 'github', status: 'success' });
    return completeGithubOAuthLogin(existingUser[0].id, githubUser, false);
  }

  // New user — create directly (self-hosted, no consent gate)
  const newUser = await createGithubOAuthUser(githubUser);
  return completeGithubOAuthLogin(newUser.id, githubUser, true);
}

/**
 * Link GitHub account to existing user
 */
async function linkGithubAccount(userId: string, githubUser: GitHubUserInfo): Promise<void> {
  // Encrypt tokens before storage
  await db.insert(userOauthAccounts).values({
    userId,
    provider: 'github',
    providerUserId: githubUser.githubId,
    providerEmail: githubUser.email,
    accessToken: encryptOAuthTokenOptional(githubUser.accessToken),
    refreshToken: null, // GitHub doesn't provide refresh tokens
    tokenExpiresAt: null, // GitHub tokens don't expire
    rawProfile: githubUser.rawProfile,
  });
}

/**
 * Complete GitHub OAuth login - get user data and issue JWT
 * If 2FA is enabled, returns challenge token instead
 */
async function completeGithubOAuthLogin(
  userId: string,
  _githubUser: GitHubUserInfo,
  isNewUser: boolean
): Promise<GitHubAuthResult> {
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
    authOperationsTotal.inc({ operation: 'github_oauth', status: '2fa_required' });
    userLoginsTotal.inc({ method: 'github', status: '2fa_required' });
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

export const githubOAuthMethods = {
  getGithubAuthUrl,
  handleGithubCallback,
  processGithubAuth,
  linkGithubAccount,
  completeGithubOAuthLogin,
};
