import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { requireAuth } from '../middlewares/auth.js';
import { orgService } from '../services/orgService.js';
import type { Variables } from '../types/index.js';

const orgsRoute = new Hono<{ Variables: Variables }>();

// All routes require authentication
orgsRoute.use(requireAuth);

// Validation schemas
const updateOrgSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  logoUrl: z.string().url().max(255).optional().nullable(),
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

export default orgsRoute;
