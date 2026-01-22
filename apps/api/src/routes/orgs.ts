import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { setCookie } from 'hono/cookie';
import { requireAuth } from '../middlewares/auth.js';
import { orgService } from '../services/orgService.js';
import { orgSettingsService } from '../services/orgSettingsService.js';
import type { Variables, SubscriptionTier } from '../types/index.js';

// Helper to set JWT cookie (same as in auth routes)
const setAuthCookie = (c: Parameters<typeof setCookie>[0], token: string) => {
  setCookie(c, 'jwt', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Strict',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });
};

const orgsRoute = new Hono<{ Variables: Variables }>();

// All routes require authentication
orgsRoute.use(requireAuth);

// Validation schemas
const createOrgSchema = z.object({
  orgName: z.string().min(2, 'Organization name must be at least 2 characters').max(32, 'Organization name must be at most 32 characters'),
  fullName: z.string().min(1, 'Full name is required').max(64, 'Full name must be at most 64 characters').optional(),
  title: z.enum(['devops', 'cto', 'developer', 'security', 'personal', 'other']).optional(),
});

const updateOrgSchema = z.object({
  name: z.string().min(1).max(32, 'Organization name must be at most 32 characters').optional(),
  logoUrl: z.string().url().max(255).optional().nullable(),
});

const updateOrgSettingsSchema = z.object({
  requiredTags: z.array(z.string().min(1).max(100)).max(20).optional(),
  hiddenFindingTypes: z.array(z.string()).max(50).optional(),
  hideTrivial: z.boolean().optional(),
});

// POST /orgs - Create organization (Step 4 of signup flow)
orgsRoute.post('/', zValidator('json', createOrgSchema), async (c) => {
  const userId = c.get('userId');
  const { orgName, fullName, title } = c.req.valid('json');

  const result = await orgService.createOrg(userId, orgName, fullName, title);

  // Set the new JWT cookie with orgId
  setAuthCookie(c, result.token);

  return c.json({ data: result.org, token: result.token }, 201);
});

// GET /orgs - List user's organizations
orgsRoute.get('/', async (c) => {
  const userId = c.get('userId');
  const orgs = await orgService.getUserOrgs(userId);
  return c.json({ data: orgs });
});

// GET /orgs/:id - Get organization details
orgsRoute.get('/:id', async (c) => {
  const orgId = c.req.param('id');
  const userId = c.get('userId');

  const org = await orgService.getOrg(orgId, userId);
  return c.json({ data: org });
});

// PATCH /orgs/:id - Update organization
orgsRoute.patch('/:id', zValidator('json', updateOrgSchema), async (c) => {
  const orgId = c.req.param('id');
  const userId = c.get('userId');
  const data = c.req.valid('json');

  const org = await orgService.updateOrg(orgId, userId, data);
  return c.json({ data: org });
});

// GET /orgs/:id/members - Get organization members
orgsRoute.get('/:id/members', async (c) => {
  const orgId = c.req.param('id');
  const userId = c.get('userId');

  const members = await orgService.getOrgMembers(orgId, userId);
  return c.json({ data: members });
});

// GET /orgs/:id/settings - Get organization viewing settings
orgsRoute.get('/:id/settings', async (c) => {
  const orgId = c.req.param('id');
  const userId = c.get('userId');

  const settings = await orgSettingsService.getSettings(orgId, userId);
  return c.json({
    data: {
      requiredTags: settings.requiredTags as string[],
      hiddenFindingTypes: settings.hiddenFindingTypes as string[],
      hideTrivial: settings.hideTrivial,
    },
  });
});

// PATCH /orgs/:id/settings - Update organization viewing settings
orgsRoute.patch('/:id/settings', zValidator('json', updateOrgSettingsSchema), async (c) => {
  const orgId = c.req.param('id');
  const userId = c.get('userId');
  const data = c.req.valid('json');

  const settings = await orgSettingsService.updateSettings(orgId, userId, data);
  return c.json({
    data: {
      requiredTags: settings.requiredTags as string[],
      hiddenFindingTypes: settings.hiddenFindingTypes as string[],
      hideTrivial: settings.hideTrivial,
    },
  });
});

// =============================================================================
// Subscription Routes
// =============================================================================

const upgradeSubscriptionSchema = z.object({
  targetTier: z.enum(['free', 'pro', 'team']),
});

// GET /orgs/:id/subscription - Get subscription status
orgsRoute.get('/:id/subscription', async (c) => {
  const orgId = c.req.param('id');
  const userId = c.get('userId');

  const status = await orgService.getSubscriptionStatus(orgId, userId);
  return c.json({ data: status });
});

// POST /orgs/:id/subscription/upgrade - Upgrade tier (mock)
orgsRoute.post('/:id/subscription/upgrade', zValidator('json', upgradeSubscriptionSchema), async (c) => {
  const orgId = c.req.param('id');
  const userId = c.get('userId');
  const { targetTier } = c.req.valid('json');

  const result = await orgService.upgradeSubscription(orgId, userId, targetTier as SubscriptionTier);
  return c.json({ data: result });
});

export default orgsRoute;
