import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { asc, desc, eq, and, gte, lte, inArray, sql } from 'drizzle-orm';
import { requireAuth } from '../middlewares/auth.js';
import { requireNoProcessingRestriction } from '../middlewares/processingRestriction.js';
import { rateLimit } from '../middlewares/rateLimit.js';
import { orgService, getOrgTier, verifyOrgAdmin } from '../services/orgService.js';
import { orgSettingsService } from '../services/orgSettingsService.js';
import { invitationService } from '../services/invitationService.js';
import { apiKeyService } from '../services/apiKeyService.js';
import { setAuthTokens } from '../lib/authTokens.js';
import { db } from '../lib/db.js';
import { auditLogs, userOrgMembers, users } from '../db/schema.js';
import { HTTP403Error } from '../lib/errors.js';
import { TIER_LIMITS, type Variables, type SubscriptionTier } from '../types/index.js';

const orgsRoute = new Hono<{ Variables: Variables }>();

// All routes require authentication
orgsRoute.use(requireAuth);
// Block write operations when GDPR processing restriction is active (Article 18)
orgsRoute.use('*', async (c, next) => {
  if (c.req.method !== 'GET') {
    return requireNoProcessingRestriction(c, next);
  }
  await next();
});

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

  // Issue new tokens with the new orgId
  const { accessToken } = await setAuthTokens(c, userId, result.org.id);

  return c.json({ data: result.org, accessToken }, 201);
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

// PATCH /orgs/:id - Update organization (admin-only)
orgsRoute.patch('/:id', zValidator('json', updateOrgSchema), async (c) => {
  const orgId = c.req.param('id');
  const userId = c.get('userId');
  const data = c.req.valid('json');

  await verifyOrgAdmin(orgId, userId);
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

// PATCH /orgs/:id/settings - Update organization viewing settings (admin-only)
orgsRoute.patch('/:id/settings', zValidator('json', updateOrgSettingsSchema), async (c) => {
  const orgId = c.req.param('id');
  const userId = c.get('userId');
  const data = c.req.valid('json');

  await verifyOrgAdmin(orgId, userId);
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
// Audit Logs (Team-only)
// =============================================================================

const auditLogQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(50),
  action: z.string().max(64).optional(),
  userId: z.string().uuid().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  status: z.enum(['2xx', '3xx', '4xx', '5xx']).optional(),
});

// GET /orgs/:id/audit-logs - List audit logs for organization (Team-only)
orgsRoute.get('/:id/audit-logs', zValidator('query', auditLogQuerySchema), async (c) => {
  const orgId = c.req.param('id');
  const userId = c.get('userId');

  // Verify membership
  await orgService.getOrg(orgId, userId);

  // Check tier
  const tier = await getOrgTier(orgId);
  if (!TIER_LIMITS[tier].canViewAuditLogs) {
    throw new HTTP403Error('Audit logs are available on the Team plan only. Upgrade to Team for full audit trail.');
  }

  const { page, limit, action, userId: userId_filter, startDate, endDate, sortOrder, status } = c.req.valid('query');
  const offset = (page - 1) * limit;

  // Build conditions using a subquery for org membership (avoids large IN lists)
  const membershipSubquery = db
    .select({ userId: userOrgMembers.userId })
    .from(userOrgMembers)
    .where(eq(userOrgMembers.orgId, orgId));

  const conditions = [inArray(auditLogs.userId, membershipSubquery)];
  if (action) conditions.push(eq(auditLogs.action, action));
  if (userId_filter) conditions.push(eq(auditLogs.userId, userId_filter));
  if (startDate) conditions.push(gte(auditLogs.timestamp, new Date(startDate)));
  if (endDate) conditions.push(lte(auditLogs.timestamp, new Date(endDate)));
  if (status) {
    const base = parseInt(status[0]) * 100;
    conditions.push(gte(auditLogs.statusCode, base));
    conditions.push(lte(auditLogs.statusCode, base + 99));
  }

  // Single query with COUNT(*) OVER() window function for consistent pagination
  const rows = await db
    .select({
      id: auditLogs.id,
      timestamp: auditLogs.timestamp,
      userId: auditLogs.userId,
      action: auditLogs.action,
      method: auditLogs.method,
      path: auditLogs.path,
      statusCode: auditLogs.statusCode,
      ipAddress: auditLogs.ipAddress,
      durationMs: auditLogs.durationMs,
      userEmail: users.email,
      userFullName: users.fullName,
      totalCount: sql<number>`count(*) over()`,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.userId, users.id))
    .where(and(...conditions))
    .orderBy(sortOrder === 'asc' ? asc(auditLogs.timestamp) : desc(auditLogs.timestamp))
    .offset(offset)
    .limit(limit);

  const total = Number(rows[0]?.totalCount ?? 0);
  const logs = rows.map(({ totalCount: _, ...rest }) => rest);

  return c.json({
    data: logs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// =============================================================================
// Team Members & Invitations (Team-only)
// =============================================================================

const createInvitationSchema = z.object({
  email: z.string().email().max(255),
  role: z.enum(['admin', 'member']).default('member'),
});

const changeMemberRoleSchema = z.object({
  role: z.enum(['admin', 'member']),
});

// POST /orgs/:id/invitations — Create invitation (admin, Team-only)
orgsRoute.post('/:id/invitations', zValidator('json', createInvitationSchema), async (c) => {
  const orgId = c.req.param('id');
  const userId = c.get('userId');
  const { email, role } = c.req.valid('json');

  const result = await invitationService.createInvitation(orgId, userId, email, role);
  return c.json({ data: result }, 201);
});

// GET /orgs/:id/invitations — List pending invitations (admin)
orgsRoute.get('/:id/invitations', async (c) => {
  const orgId = c.req.param('id');
  const userId = c.get('userId');

  const invitations = await invitationService.listInvitations(orgId, userId);
  return c.json({ data: invitations });
});

// DELETE /orgs/:id/invitations/:invId — Cancel invitation (admin)
orgsRoute.delete('/:id/invitations/:invId', async (c) => {
  const orgId = c.req.param('id');
  const userId = c.get('userId');
  const invId = c.req.param('invId');

  await invitationService.cancelInvitation(orgId, userId, invId);
  return c.json({ data: { canceled: true } });
});

// POST /orgs/:id/invitations/:invId/resend — Resend invitation email (admin)
orgsRoute.post('/:id/invitations/:invId/resend', async (c) => {
  const orgId = c.req.param('id');
  const userId = c.get('userId');
  const invId = c.req.param('invId');

  await invitationService.resendInvitation(orgId, userId, invId);
  return c.json({ data: { resent: true } });
});

// DELETE /orgs/:id/members/:memberId — Remove member (admin)
orgsRoute.delete('/:id/members/:memberId', async (c) => {
  const orgId = c.req.param('id');
  const userId = c.get('userId');
  const memberId = c.req.param('memberId');

  await invitationService.removeMember(orgId, userId, memberId);
  return c.json({ data: { removed: true } });
});

// PATCH /orgs/:id/members/:memberId — Change member role (admin)
orgsRoute.patch('/:id/members/:memberId', zValidator('json', changeMemberRoleSchema), async (c) => {
  const orgId = c.req.param('id');
  const userId = c.get('userId');
  const memberId = c.req.param('memberId');
  const { role } = c.req.valid('json');

  await invitationService.changeMemberRole(orgId, userId, memberId, role);
  return c.json({ data: { role } });
});

// GET /orgs/:id/seats — Get seat/billing info
orgsRoute.get('/:id/seats', async (c) => {
  const orgId = c.req.param('id');
  const userId = c.get('userId');

  // Verify membership (any role)
  await orgService.getOrg(orgId, userId);

  const seatInfo = await invitationService.getSeatInfo(orgId);
  return c.json({ data: seatInfo });
});

// =============================================================================
// API Keys (Team-only)
// =============================================================================

const createApiKeySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be at most 100 characters'),
  description: z.string().max(500).optional(),
});

// POST /orgs/:id/api-keys — Create API key (admin, Team-only)
orgsRoute.post('/:id/api-keys', zValidator('json', createApiKeySchema), async (c) => {
  const orgId = c.req.param('id');
  const userId = c.get('userId');
  const { name, description } = c.req.valid('json');

  const result = await apiKeyService.createApiKey(orgId, userId, name, description);
  return c.json({ data: result }, 201);
});

// GET /orgs/:id/api-keys — List API keys (any member, Team-only)
orgsRoute.get('/:id/api-keys', async (c) => {
  const orgId = c.req.param('id');
  const userId = c.get('userId');

  // Verify membership (any role)
  await orgService.getOrg(orgId, userId);

  // Check tier
  const tier = await getOrgTier(orgId);
  if (!TIER_LIMITS[tier].canUseApiKeys) {
    throw new HTTP403Error('API keys are available on the Team plan only.');
  }

  const keys = await apiKeyService.listApiKeys(orgId);
  return c.json({ data: keys });
});

// DELETE /orgs/:id/api-keys/:keyId — Revoke API key (admin, Team-only)
orgsRoute.delete('/:id/api-keys/:keyId', async (c) => {
  const orgId = c.req.param('id');
  const userId = c.get('userId');
  const keyId = c.req.param('keyId');

  await apiKeyService.revokeApiKey(orgId, userId, keyId);
  return c.json({ data: { revoked: true } });
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

// Rate limit subscription changes: 10 requests per minute per user
const subscriptionRateLimit = rateLimit({
  keyPrefix: 'subscription',
  maxRequests: 10,
  windowSeconds: 60,
  keyExtractor: (c) => c.get('userId') || 'anon',
  message: 'Too many subscription requests. Please slow down.',
  failOpen: true,
});

// POST /orgs/:id/subscription/upgrade - Upgrade tier (mock)
orgsRoute.post('/:id/subscription/upgrade', subscriptionRateLimit, zValidator('json', upgradeSubscriptionSchema), async (c) => {
  const orgId = c.req.param('id');
  const userId = c.get('userId');
  const { targetTier } = c.req.valid('json');

  const result = await orgService.upgradeSubscription(orgId, userId, targetTier as SubscriptionTier);
  return c.json({ data: result });
});

export default orgsRoute;
