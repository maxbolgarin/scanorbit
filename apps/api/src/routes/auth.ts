import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { setCookie, deleteCookie, getCookie } from 'hono/cookie';
import { authService } from '../services/authService.js';
import { twoFactorService } from '../services/twoFactorService.js';
import { requireAuth } from '../middlewares/auth.js';
import { rateLimiters } from '../middlewares/rateLimit.js';
import { config } from '../lib/config.js';
import { redis, twoFactorStore, refreshTokenStore } from '../lib/redis.js';
import { jwt } from '../lib/jwt.js';
import { HTTP401Error } from '../lib/errors.js';
import { listmonkService } from '../services/listmonkService.js';
import { sendImmediate } from '../services/dripSchedulerService.js';
import type { Variables } from '../types/index.js';

const authRoute = new Hono<{ Variables: Variables }>();

// Validation schemas
const signupSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().min(1, 'Full name is required').max(64, 'Full name must be at most 64 characters').optional(),
  orgName: z.string().min(2, 'Organization name must be at least 2 characters').max(32, 'Organization name must be at most 32 characters').optional(),
});

const verifyEmailSchema = z.object({
  email: z.string().email('Invalid email format'),
  code: z.string().length(6, 'Verification code must be 6 digits'),
});

const resendVerificationSchema = z.object({
  email: z.string().email('Invalid email format'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

const switchOrgSchema = z.object({
  orgId: z.string().uuid('Invalid organization ID'),
});

// New signup flow schemas
const sendCodeSchema = z.object({
  email: z.string().email('Invalid email format'),
});

const verifyCodeSchema = z.object({
  email: z.string().email('Invalid email format'),
  code: z.string().length(6, 'Verification code must be 6 digits'),
});

const completeSignupSchema = z.object({
  signupToken: z.string().min(1, 'Signup token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  consent: z.boolean().refine((val) => val === true, {
    message: 'You must agree to the Terms of Service and Privacy Policy',
  }),
  newsletterConsent: z.boolean().optional().default(false),
});

const resendCodeSchema = z.object({
  email: z.string().email('Invalid email format'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

const setPasswordSchema = z.object({
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

const updateProfileSchema = z.object({
  fullName: z.string().min(1, 'Full name must not be empty').max(64, 'Full name must be at most 64 characters').optional(),
});

// 2FA schemas
const twoFactorVerifySchema = z.object({
  code: z.string().length(6, 'Verification code must be 6 digits'),
});

const twoFactorDisableSchema = z.object({
  password: z.string().min(1, 'Password is required'),
  code: z.string().length(6, 'Verification code must be 6 digits'),
});

const twoFactorChallengeVerifySchema = z.object({
  challengeToken: z.string().min(1, 'Challenge token is required'),
  code: z.string().length(6, 'Verification code must be 6 digits'),
});

const twoFactorRecoveryVerifySchema = z.object({
  challengeToken: z.string().min(1, 'Challenge token is required'),
  recoveryCode: z.string().min(1, 'Recovery code is required'),
});

const twoFactorRegenerateCodesSchema = z.object({
  password: z.string().min(1, 'Password is required'),
  code: z.string().length(6, 'Verification code must be 6 digits'),
});

// ============================================
// Auth Cookie Helpers
// ============================================

/**
 * Set refresh token in httpOnly secure cookie
 */
const setRefreshTokenCookie = (c: Parameters<typeof setCookie>[0], refreshToken: string) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const cookieOptions: Parameters<typeof setCookie>[3] = {
    httpOnly: true,
    secure: isProduction,
    // In production: Use 'None' to allow cookie on cross-origin POST requests (e.g., /auth/refresh from app.scanorbit.cloud)
    // In development: Use 'Lax' because SameSite=None without Secure flag is rejected by modern browsers
    sameSite: isProduction ? 'None' : 'Lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  };

  // Set domain to parent domain in production to share cookie across subdomains
  // e.g., '.scanorbit.cloud' allows cookie from api.scanorbit.cloud to be sent to app.scanorbit.cloud
  if (config.cookieDomain) {
    cookieOptions.domain = config.cookieDomain;
  }

  setCookie(c, 'refresh_token', refreshToken, cookieOptions);
};

/**
 * Clear auth cookies (for logout)
 */
const clearAuthCookies = (c: Parameters<typeof deleteCookie>[0]) => {
  const deleteOptions: Parameters<typeof deleteCookie>[2] = { path: '/' };
  if (config.cookieDomain) {
    deleteOptions.domain = config.cookieDomain;
  }
  deleteCookie(c, 'refresh_token', deleteOptions);
};

/**
 * Issue new access and refresh tokens for a user
 * - Access token (5 min): returned in response body, stored in frontend memory
 * - Refresh token (7 days): stored in httpOnly secure cookie
 */
const setAuthTokens = async (
  c: Parameters<typeof setCookie>[0],
  userId: string,
  orgId: string | null
): Promise<{ accessToken: string }> => {
  // Generate access token (short-lived, 5 min)
  const accessToken = await jwt.signAccessToken({ userId, orgId });

  // Generate refresh token (long-lived, 7 days)
  const { token: refreshToken, tokenId } = await jwt.signRefreshToken(userId);

  // Store refresh token ID in Redis for revocation tracking
  // This MUST succeed before setting the cookie, otherwise user will have
  // a valid JWT but no Redis entry, causing "Token revoked" errors
  try {
    await refreshTokenStore.store(tokenId, userId);
  } catch (error) {
    console.error(`[Auth] Failed to store refresh token for user ${userId.slice(0, 8)}...:`, error);
    throw new Error('Failed to establish session. Please try again.');
  }

  // Only set cookie after Redis storage is confirmed
  setRefreshTokenCookie(c, refreshToken);

  return { accessToken };
};

// POST /auth/signup - Rate limited by both email and IP to prevent spam
authRoute.post(
  '/signup',
  zValidator('json', signupSchema),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rateLimiters.sendCodeStrict((c: any) => c.req.valid('json').email),
  async (c) => {
    const { email, password, fullName, orgName } = c.req.valid('json');

    const { user, org, message } = await authService.signup(
      email,
      password,
      fullName ?? '',
      orgName
    );

    // Issue new access and refresh tokens
    const { accessToken } = await setAuthTokens(c, user.id, org?.id ?? null);

    return c.json(
      {
        user,
        org,
        accessToken,
        message,
      },
      201
    );
  }
);

// POST /auth/verify-email - Rate limited by both email and IP to prevent brute force
authRoute.post(
  '/verify-email',
  zValidator('json', verifyEmailSchema),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rateLimiters.verifyCodeStrict((c: any) => c.req.valid('json').email),
  async (c) => {
    const { email, code } = c.req.valid('json');

    const result = await authService.verifyEmail(email, code);

    return c.json(result);
  }
);

// POST /auth/resend-verification - Rate limited by both email and IP to prevent spam
authRoute.post(
  '/resend-verification',
  zValidator('json', resendVerificationSchema),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rateLimiters.sendCodeStrict((c: any) => c.req.valid('json').email),
  async (c) => {
    const { email } = c.req.valid('json');

    const result = await authService.resendVerificationCode(email);

    return c.json(result);
  }
);

// POST /auth/login - Rate limited by both email and IP to prevent brute force
authRoute.post(
  '/login',
  zValidator('json', loginSchema),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rateLimiters.loginStrict((c: any) => c.req.valid('json').email),
  async (c) => {
    const { email, password } = c.req.valid('json');

    const result = await authService.login(email, password);

    // Check if 2FA is required
    if ('requires2FA' in result && result.requires2FA) {
      return c.json({
        requires2FA: true,
        challengeToken: result.challengeToken,
      });
    }

    // Normal login (no 2FA)
    const { user, orgs } = result;

    // Issue new access and refresh tokens
    const { accessToken } = await setAuthTokens(c, user.id, orgs[0]?.id ?? null);

    return c.json({
      user,
      orgs,
      accessToken,
    });
  }
);

// POST /auth/logout - Revoke refresh token and clear cookies (API call)
authRoute.post('/logout', async (c) => {
  // Try to revoke the refresh token if present
  const refreshToken = getCookie(c, 'refresh_token');
  if (refreshToken) {
    try {
      const payload = await jwt.verifyRefreshToken(refreshToken);
      await refreshTokenStore.revoke(payload.tokenId);
    } catch {
      // Ignore errors - token may already be invalid
    }
  }

  // Clear all auth cookies
  clearAuthCookies(c);

  return c.json({ message: 'Logged out successfully' });
});

// GET /auth/logout - Browser navigation logout (redirects to login page)
// Used when cookies are stored on API origin (e.g., OAuth flow sets cookie directly)
// and the frontend can't send them via fetch through a proxy
authRoute.get('/logout', async (c) => {
  // Try to revoke the refresh token if present
  const refreshToken = getCookie(c, 'refresh_token');
  if (refreshToken) {
    try {
      const payload = await jwt.verifyRefreshToken(refreshToken);
      await refreshTokenStore.revoke(payload.tokenId);
    } catch {
      // Ignore errors - token may already be invalid
    }
  }

  // Clear all auth cookies
  clearAuthCookies(c);

  // Redirect to login page
  return c.redirect(`${config.frontendUrl}/login`);
});

// POST /auth/refresh - Get new access token using refresh token
authRoute.post('/refresh', async (c) => {
  const refreshToken = getCookie(c, 'refresh_token');

  if (!refreshToken) {
    console.log('[Refresh] No refresh token cookie found');
    throw new HTTP401Error('No refresh token');
  }

  try {
    // Verify the refresh token
    const payload = await jwt.verifyRefreshToken(refreshToken);
    const tokenLog = payload.tokenId.slice(0, 8) + '...';
    const userLog = payload.userId.slice(0, 8) + '...';

    console.log(`[Refresh] JWT verified - tokenId: ${tokenLog}, userId: ${userLog}`);

    // Check if token has been revoked
    const isValid = await refreshTokenStore.isValid(payload.tokenId);

    if (!isValid) {
      // Log diagnostic info for debugging
      const tokenKey = `refresh:${payload.tokenId}`;
      const userKey = `refresh:user:${payload.userId}`;
      const [tokenExists, userTokens] = await Promise.all([
        redis.exists(tokenKey),
        redis.smembers(userKey),
      ]);

      console.warn(`[Refresh] Token revoked - diagnostics:`, {
        tokenId: tokenLog,
        userId: userLog,
        tokenKeyExists: tokenExists === 1,
        userTokenCount: userTokens.length,
      });

      clearAuthCookies(c);
      throw new HTTP401Error('Token revoked');
    }

    // Get user's current org membership
    const { orgs } = await authService.getMe(payload.userId);
    const orgId = orgs[0]?.id ?? null;

    // Issue new access token only (refresh token stays the same until it expires)
    const accessToken = await jwt.signAccessToken({ userId: payload.userId, orgId });

    return c.json({ accessToken });
  } catch (error) {
    if (error instanceof HTTP401Error) {
      throw error;
    }
    console.error('[Refresh] Unexpected error:', error);
    // Clear invalid refresh cookie
    clearAuthCookies(c);
    throw new HTTP401Error('Invalid refresh token');
  }
});

// GET /auth/me - Get current user
authRoute.get('/me', requireAuth, async (c) => {
  const userId = c.get('userId');
  const result = await authService.getMe(userId);
  return c.json(result);
});

// POST /auth/switch-org - Switch active organization
authRoute.post(
  '/switch-org',
  requireAuth,
  zValidator('json', switchOrgSchema),
  async (c) => {
    const userId = c.get('userId');
    const { orgId } = c.req.valid('json');

    // Verify user has access to the org (switchOrg will throw if not)
    await authService.switchOrg(userId, orgId);

    // Issue new access token with the new orgId
    const accessToken = await jwt.signAccessToken({ userId, orgId });

    return c.json({ accessToken });
  }
);

// ============================================
// New Signup Flow Endpoints
// ============================================

// POST /auth/send-code - Send verification code to email (Step 1) - Rate limited by both email and IP
authRoute.post(
  '/send-code',
  zValidator('json', sendCodeSchema),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rateLimiters.sendCodeStrict((c: any) => c.req.valid('json').email),
  async (c) => {
    const { email } = c.req.valid('json');

    const result = await authService.sendVerificationCode(email);

    return c.json(result);
  }
);

// POST /auth/verify-code - Verify code and get signup token (Step 2) - Rate limited by both email and IP
authRoute.post(
  '/verify-code',
  zValidator('json', verifyCodeSchema),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rateLimiters.verifyCodeStrict((c: any) => c.req.valid('json').email),
  async (c) => {
    const { email, code } = c.req.valid('json');

    const result = await authService.verifySignupCode(email, code);

    return c.json(result);
  }
);

// POST /auth/complete-signup - Complete signup with password (Step 3) - Rate limited
authRoute.post('/complete-signup', rateLimiters.verifyCode, zValidator('json', completeSignupSchema), async (c) => {
  // consent is validated by zod schema (must be true)
  const { signupToken, password } = c.req.valid('json');

  // Extract client info for GDPR consent logging
  const ipAddress = c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
    || c.req.header('x-real-ip')
    || 'unknown';
  const userAgent = c.req.header('user-agent') || 'unknown';

  const { user } = await authService.completeSignup(signupToken, password, {
    ipAddress,
    userAgent,
  });

  // Issue new access and refresh tokens
  const { accessToken } = await setAuthTokens(c, user.id, null);

  // Add to free-new campaign list (product emails, always)
  listmonkService.onUserSignup(user.email, user.fullName).catch(() => {});
  listmonkService.updateAttribsByEmail(user.email, { tier: 'free', signup_at: new Date().toISOString() }).catch(() => {});
  sendImmediate({ sequenceName: 'free-new', email: user.email, name: user.fullName }).catch(() => {});

  // Subscribe to newsletter only if user consented (marketing emails)
  if (c.req.valid('json').newsletterConsent) {
    listmonkService.subscribe(user.email, user.fullName).catch(() => {});
  }

  return c.json({
    user,
    accessToken,
  }, 201);
});

// POST /auth/resend-code - Resend verification code - Rate limited by both email and IP
authRoute.post(
  '/resend-code',
  zValidator('json', resendCodeSchema),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rateLimiters.sendCodeStrict((c: any) => c.req.valid('json').email),
  async (c) => {
    const { email } = c.req.valid('json');

    const result = await authService.resendSignupCode(email);

    return c.json(result);
  }
);

// ============================================
// Password Reset Endpoints (Public)
// ============================================

const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

// POST /auth/forgot-password - Request password reset email
authRoute.post(
  '/forgot-password',
  rateLimiters.passwordReset,
  zValidator('json', forgotPasswordSchema),
  async (c) => {
    const { email } = c.req.valid('json');
    const result = await authService.requestPasswordReset(email);
    return c.json(result);
  }
);

// POST /auth/reset-password - Reset password with token
authRoute.post(
  '/reset-password',
  rateLimiters.passwordReset,
  zValidator('json', resetPasswordSchema),
  async (c) => {
    const { token, password } = c.req.valid('json');
    const result = await authService.resetPassword(token, password);
    return c.json(result);
  }
);

// ============================================
// Password & Profile Endpoints
// ============================================

// POST /auth/change-password - Change user password
authRoute.post(
  '/change-password',
  requireAuth,
  rateLimiters.passwordReset,
  zValidator('json', changePasswordSchema),
  async (c) => {
    const userId = c.get('userId');
    const { currentPassword, newPassword } = c.req.valid('json');

    const result = await authService.changePassword(userId, currentPassword, newPassword);

    return c.json(result);
  }
);

// POST /auth/set-password - Set password for OAuth-only users
authRoute.post(
  '/set-password',
  requireAuth,
  rateLimiters.passwordReset,
  zValidator('json', setPasswordSchema),
  async (c) => {
    const userId = c.get('userId');
    const { newPassword } = c.req.valid('json');

    const result = await authService.setPassword(userId, newPassword);

    return c.json(result);
  }
);

// PATCH /auth/profile - Update user profile
authRoute.patch(
  '/profile',
  requireAuth,
  zValidator('json', updateProfileSchema),
  async (c) => {
    const userId = c.get('userId');
    const updates = c.req.valid('json');

    const result = await authService.updateProfile(userId, updates);

    return c.json(result);
  }
);

// ============================================
// Two-Factor Authentication Endpoints
// ============================================

// GET /auth/2fa/status - Get 2FA status
authRoute.get('/2fa/status', requireAuth, async (c) => {
  const userId = c.get('userId');
  const status = await twoFactorService.getStatus(userId);
  return c.json(status);
});

// POST /auth/2fa/setup/init - Start 2FA setup
authRoute.post('/2fa/setup/init', requireAuth, async (c) => {
  const userId = c.get('userId');
  const result = await twoFactorService.initSetup(userId);
  return c.json(result);
});

// POST /auth/2fa/setup/verify - Verify code and enable 2FA
authRoute.post(
  '/2fa/setup/verify',
  requireAuth,
  rateLimiters.verifyCode,
  zValidator('json', twoFactorVerifySchema),
  async (c) => {
    const userId = c.get('userId');
    const { code } = c.req.valid('json');

    const result = await twoFactorService.verifyAndEnable(userId, code);

    return c.json(result);
  }
);

// POST /auth/2fa/disable - Disable 2FA
authRoute.post(
  '/2fa/disable',
  requireAuth,
  rateLimiters.verifyCode,
  zValidator('json', twoFactorDisableSchema),
  async (c) => {
    const userId = c.get('userId');
    const { password, code } = c.req.valid('json');

    await twoFactorService.disable(userId, password, code);

    return c.json({ success: true, message: 'Two-factor authentication has been disabled' });
  }
);

// POST /auth/2fa/verify - Verify TOTP during login challenge
authRoute.post(
  '/2fa/verify',
  rateLimiters.verifyCode,
  zValidator('json', twoFactorChallengeVerifySchema),
  async (c) => {
    const { challengeToken, code } = c.req.valid('json');

    // Verify challenge token
    const challenge = await twoFactorStore.getChallenge(challengeToken);
    if (!challenge) {
      return c.json({ error: 'Challenge expired or invalid. Please log in again.' }, 400);
    }

    // Rate limiting by userId
    const attempts = await twoFactorStore.checkVerifyAttempts(`login:${challenge.userId}`);
    if (!attempts.allowed) {
      return c.json({ error: 'Too many verification attempts. Please try again later.' }, 429);
    }

    await twoFactorStore.incrementVerifyAttempts(`login:${challenge.userId}`);

    // Verify TOTP code
    const isValid = await twoFactorService.verify(challenge.userId, code);

    if (!isValid) {
      const remaining = attempts.attemptsRemaining - 1;
      return c.json({
        error: `Invalid verification code. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`
      }, 400);
    }

    // Success - delete challenge and complete login
    await twoFactorStore.deleteChallenge(challengeToken);
    await twoFactorStore.resetVerifyAttempts(`login:${challenge.userId}`);

    // Complete login - get user data
    const result = await authService.completeLoginAfter2FA(challenge.userId);

    // Issue new access and refresh tokens
    const { accessToken } = await setAuthTokens(c, result.user.id, result.orgs[0]?.id ?? null);

    return c.json({
      user: result.user,
      orgs: result.orgs,
      accessToken,
    });
  }
);

// POST /auth/2fa/verify-recovery - Use recovery code during login
authRoute.post(
  '/2fa/verify-recovery',
  rateLimiters.verifyCode,
  zValidator('json', twoFactorRecoveryVerifySchema),
  async (c) => {
    const { challengeToken, recoveryCode } = c.req.valid('json');

    // Verify challenge token
    const challenge = await twoFactorStore.getChallenge(challengeToken);
    if (!challenge) {
      return c.json({ error: 'Challenge expired or invalid. Please log in again.' }, 400);
    }

    // Rate limiting by userId
    const attempts = await twoFactorStore.checkVerifyAttempts(`recovery:${challenge.userId}`);
    if (!attempts.allowed) {
      return c.json({ error: 'Too many recovery attempts. Please try again later.' }, 429);
    }

    await twoFactorStore.incrementVerifyAttempts(`recovery:${challenge.userId}`);

    // Verify recovery code
    const isValid = await twoFactorService.verifyRecoveryCode(challenge.userId, recoveryCode);

    if (!isValid) {
      const remaining = attempts.attemptsRemaining - 1;
      return c.json({
        error: `Invalid recovery code. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`
      }, 400);
    }

    // Success - delete challenge and complete login
    await twoFactorStore.deleteChallenge(challengeToken);
    await twoFactorStore.resetVerifyAttempts(`recovery:${challenge.userId}`);

    // Complete login - get user data
    const result = await authService.completeLoginAfter2FA(challenge.userId);

    // Issue new access and refresh tokens
    const { accessToken } = await setAuthTokens(c, result.user.id, result.orgs[0]?.id ?? null);

    return c.json({
      user: result.user,
      orgs: result.orgs,
      accessToken,
    });
  }
);

// POST /auth/2fa/recovery-codes/regenerate - Regenerate recovery codes
authRoute.post(
  '/2fa/recovery-codes/regenerate',
  requireAuth,
  rateLimiters.verifyCode,
  zValidator('json', twoFactorRegenerateCodesSchema),
  async (c) => {
    const userId = c.get('userId');
    const { password, code } = c.req.valid('json');

    const result = await twoFactorService.regenerateRecoveryCodes(userId, password, code);

    return c.json(result);
  }
);

// ============================================
// Google OAuth Endpoints
// ============================================

// Validation schema for ID token flow
const googleTokenSchema = z.object({
  idToken: z.string().min(1, 'ID token is required'),
});

// GET /auth/google - Initiate Google OAuth flow
authRoute.get('/google', async (c) => {
  const state = await authService.generateOAuthState();
  const authUrl = authService.getGoogleAuthUrl(state);
  return c.redirect(authUrl);
});

// GET /auth/google/callback - Handle Google OAuth callback
authRoute.get('/google/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const error = c.req.query('error');

  // User denied access or other error
  if (error) {
    return c.redirect(`${config.frontendUrl}/login?error=oauth_denied`);
  }

  // Missing required parameters
  if (!code || !state) {
    return c.redirect(`${config.frontendUrl}/login?error=invalid_request`);
  }

  try {
    const result = await authService.handleGoogleCallback(code, state);

    // Check if 2FA is required
    if (result.requires2FA) {
      // Redirect to login with 2FA challenge token
      return c.redirect(`${config.frontendUrl}/login?2fa_challenge=${result.challengeToken}`);
    }

    // Set auth tokens (refresh cookie)
    // Frontend will call /auth/refresh after redirect to get access token
    await setAuthTokens(c, result.user.id, result.orgs[0]?.id ?? null);

    // Add new OAuth users to product campaign list only (fire-and-forget)
    // Do NOT auto-subscribe to newsletter — requires explicit marketing consent (GDPR Art. 7)
    if (result.isNewUser) {
      listmonkService.onUserSignup(result.user.email, result.user.fullName).catch(() => {});
      sendImmediate({ sequenceName: 'free-new', email: result.user.email, name: result.user.fullName }).catch(() => {});
    }

    // Redirect based on whether user has an org
    const redirectPath = result.hasOrg ? '/overview' : '/onboarding/org';
    return c.redirect(`${config.frontendUrl}${redirectPath}?oauth=success`);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'oauth_failed';
    return c.redirect(`${config.frontendUrl}/login?error=${encodeURIComponent(errorMessage)}`);
  }
});

// POST /auth/google/token - Exchange ID token (for frontend-initiated flow)
authRoute.post('/google/token', zValidator('json', googleTokenSchema), async (c) => {
  const { idToken } = c.req.valid('json');

  const result = await authService.handleGoogleIdToken(idToken);

  // Check if 2FA is required
  if (result.requires2FA) {
    return c.json({
      requires2FA: true,
      challengeToken: result.challengeToken,
    });
  }

  // Issue new access and refresh tokens
  const { accessToken } = await setAuthTokens(c, result.user.id, result.orgs[0]?.id ?? null);

  // Add new OAuth users to product campaign list only (fire-and-forget)
  // Do NOT auto-subscribe to newsletter — requires explicit marketing consent (GDPR Art. 7)
  if (result.isNewUser) {
    listmonkService.onUserSignup(result.user.email, result.user.fullName).catch(() => {});
    sendImmediate({ sequenceName: 'free-new', email: result.user.email, name: result.user.fullName }).catch(() => {});
  }

  return c.json({
    user: result.user,
    orgs: result.orgs,
    isNewUser: result.isNewUser,
    accessToken,
  });
});

// ============================================
// GitHub OAuth Endpoints
// ============================================

// GET /auth/github - Initiate GitHub OAuth flow
authRoute.get('/github', async (c) => {
  const state = await authService.generateOAuthState();
  const authUrl = authService.getGithubAuthUrl(state);
  return c.redirect(authUrl);
});

// GET /auth/github/callback - Handle GitHub OAuth callback
authRoute.get('/github/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const error = c.req.query('error');
  const errorDescription = c.req.query('error_description');

  // User denied access or other error
  if (error) {
    const errorMsg = error === 'access_denied' ? 'oauth_denied' : (errorDescription || 'oauth_failed');
    return c.redirect(`${config.frontendUrl}/login?error=${encodeURIComponent(errorMsg)}`);
  }

  // Missing required parameters
  if (!code || !state) {
    return c.redirect(`${config.frontendUrl}/login?error=invalid_request`);
  }

  try {
    const result = await authService.handleGithubCallback(code, state);

    // Check if 2FA is required
    if (result.requires2FA) {
      // Redirect to login with 2FA challenge token
      return c.redirect(`${config.frontendUrl}/login?2fa_challenge=${result.challengeToken}`);
    }

    // Set auth tokens (refresh cookie)
    // Frontend will call /auth/refresh after redirect to get access token
    await setAuthTokens(c, result.user.id, result.orgs[0]?.id ?? null);

    // Add new OAuth users to product campaign list only (fire-and-forget)
    // Do NOT auto-subscribe to newsletter — requires explicit marketing consent (GDPR Art. 7)
    if (result.isNewUser) {
      listmonkService.onUserSignup(result.user.email, result.user.fullName).catch(() => {});
      sendImmediate({ sequenceName: 'free-new', email: result.user.email, name: result.user.fullName }).catch(() => {});
    }

    // Redirect based on whether user has an org
    const redirectPath = result.hasOrg ? '/overview' : '/onboarding/org';
    return c.redirect(`${config.frontendUrl}${redirectPath}?oauth=success`);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'oauth_failed';
    return c.redirect(`${config.frontendUrl}/login?error=${encodeURIComponent(errorMessage)}`);
  }
});

export default authRoute;
