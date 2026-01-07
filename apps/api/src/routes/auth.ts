import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { setCookie, deleteCookie } from 'hono/cookie';
import { authService } from '../services/authService.js';
import { requireAuth } from '../middlewares/auth.js';
import type { Variables } from '../types/index.js';

const authRoute = new Hono<{ Variables: Variables }>();

// Validation schemas
const signupSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().min(1, 'Full name is required').optional(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

const switchOrgSchema = z.object({
  orgId: z.string().uuid('Invalid organization ID'),
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

// POST /auth/signup
authRoute.post('/signup', zValidator('json', signupSchema), async (c) => {
  const { email, password, fullName } = c.req.valid('json');

  const { user, org, token } = await authService.signup(
    email,
    password,
    fullName ?? ''
  );

  setAuthCookie(c, token);

  return c.json(
    {
      user,
      org,
      token,
    },
    201
  );
});

// POST /auth/login
authRoute.post('/login', zValidator('json', loginSchema), async (c) => {
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

export default authRoute;
