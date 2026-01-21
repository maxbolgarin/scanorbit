import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { setCookie, deleteCookie } from 'hono/cookie';
import { authService } from '../services/authService.js';
import { requireAuth } from '../middlewares/auth.js';
import { rateLimiters } from '../middlewares/rateLimit.js';
import { config } from '../lib/config.js';
import type { Variables } from '../types/index.js';

const authRoute = new Hono<{ Variables: Variables }>();

// Validation schemas
const signupSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().min(1, 'Full name is required').optional(),
  orgName: z.string().min(2, 'Organization name must be at least 2 characters').optional(),
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
  fullName: z.string().min(1, 'Full name must not be empty').optional(),
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

  const { user, orgs, token } = await authService.login(email, password);

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
