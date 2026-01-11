import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { setCookie, deleteCookie } from 'hono/cookie';
import { authService } from '../services/authService.js';
import { requireAuth } from '../middlewares/auth.js';
import { rateLimiters } from '../middlewares/rateLimit.js';
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
});

const resendCodeSchema = z.object({
  email: z.string().email('Invalid email format'),
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
  const { signupToken, password } = c.req.valid('json');

  // Extract consent info for GDPR logging
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

export default authRoute;
