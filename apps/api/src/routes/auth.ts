import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { setCookie, deleteCookie } from 'hono/cookie';
import { authService } from '../services/authService.js';
import { twoFactorService } from '../services/twoFactorService.js';
import { requireAuth } from '../middlewares/auth.js';
import { rateLimiters } from '../middlewares/rateLimit.js';
import { config } from '../lib/config.js';
import { twoFactorStore } from '../lib/redis.js';
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
});

const resendCodeSchema = z.object({
  email: z.string().email('Invalid email format'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
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

// Helper to set JWT cookie
const setAuthCookie = (c: Parameters<typeof setCookie>[0], token: string) => {
  setCookie(c, 'jwt', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Strict',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });
};

// POST /auth/signup - Rate limited to prevent spam
authRoute.post('/signup', rateLimiters.sendCode, zValidator('json', signupSchema), async (c) => {
  const { email, password, fullName, orgName } = c.req.valid('json');

  const { user, org, token, message } = await authService.signup(
    email,
    password,
    fullName ?? '',
    orgName
  );

  setAuthCookie(c, token);

  return c.json(
    {
      user,
      org,
      token,
      message,
    },
    201
  );
});

// POST /auth/verify-email - Rate limited to prevent brute force
authRoute.post('/verify-email', rateLimiters.verifyCode, zValidator('json', verifyEmailSchema), async (c) => {
  const { email, code } = c.req.valid('json');

  const result = await authService.verifyEmail(email, code);

  return c.json(result);
});

// POST /auth/resend-verification - Rate limited to prevent spam
authRoute.post('/resend-verification', rateLimiters.sendCode, zValidator('json', resendVerificationSchema), async (c) => {
  const { email } = c.req.valid('json');

  const result = await authService.resendVerificationCode(email);

  return c.json(result);
});

// POST /auth/login - Rate limited to prevent brute force
authRoute.post('/login', rateLimiters.login, zValidator('json', loginSchema), async (c) => {
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
  const { user, orgs, token } = result;
  setAuthCookie(c, token);

  return c.json({
    user,
    orgs,
    token,
  });
});

// POST /auth/logout
authRoute.post('/logout', (c) => {
  deleteCookie(c, 'jwt', { path: '/' });
  return c.json({ message: 'Logged out successfully' });
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

    const token = await authService.switchOrg(userId, orgId);

    setAuthCookie(c, token);

    return c.json({ token });
  }
);

// ============================================
// New Signup Flow Endpoints
// ============================================

// POST /auth/send-code - Send verification code to email (Step 1) - Rate limited
authRoute.post('/send-code', rateLimiters.sendCode, zValidator('json', sendCodeSchema), async (c) => {
  const { email } = c.req.valid('json');

  const result = await authService.sendVerificationCode(email);

  return c.json(result);
});

// POST /auth/verify-code - Verify code and get signup token (Step 2) - Rate limited
authRoute.post('/verify-code', rateLimiters.verifyCode, zValidator('json', verifyCodeSchema), async (c) => {
  const { email, code } = c.req.valid('json');

  const result = await authService.verifySignupCode(email, code);

  return c.json(result);
});

// POST /auth/complete-signup - Complete signup with password (Step 3) - Rate limited
authRoute.post('/complete-signup', rateLimiters.verifyCode, zValidator('json', completeSignupSchema), async (c) => {
  // consent is validated by zod schema (must be true)
  const { signupToken, password } = c.req.valid('json');

  // Extract client info for GDPR consent logging
  const ipAddress = c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
    || c.req.header('x-real-ip')
    || 'unknown';
  const userAgent = c.req.header('user-agent') || 'unknown';

  const { user, token } = await authService.completeSignup(signupToken, password, {
    ipAddress,
    userAgent,
  });

  setAuthCookie(c, token);

  return c.json({ user, token }, 201);
});

// POST /auth/resend-code - Resend verification code - Rate limited
authRoute.post('/resend-code', rateLimiters.sendCode, zValidator('json', resendCodeSchema), async (c) => {
  const { email } = c.req.valid('json');

  const result = await authService.resendSignupCode(email);

  return c.json(result);
});

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

    // Complete login - get user data and issue JWT
    const result = await authService.completeLoginAfter2FA(challenge.userId);

    setAuthCookie(c, result.token);

    return c.json({
      user: result.user,
      orgs: result.orgs,
      token: result.token,
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

    // Complete login
    const result = await authService.completeLoginAfter2FA(challenge.userId);

    setAuthCookie(c, result.token);

    return c.json({
      user: result.user,
      orgs: result.orgs,
      token: result.token,
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

    setAuthCookie(c, result.token);

    // Redirect based on whether user has an org
    const redirectPath = result.hasOrg ? '/overview' : '/onboarding/create-org';
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

  setAuthCookie(c, result.token);

  return c.json({
    user: result.user,
    orgs: result.orgs,
    isNewUser: result.isNewUser,
    token: result.token,
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

    setAuthCookie(c, result.token);

    // Redirect based on whether user has an org
    const redirectPath = result.hasOrg ? '/overview' : '/onboarding/create-org';
    return c.redirect(`${config.frontendUrl}${redirectPath}?oauth=success`);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'oauth_failed';
    return c.redirect(`${config.frontendUrl}/login?error=${encodeURIComponent(errorMessage)}`);
  }
});

export default authRoute;
