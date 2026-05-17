import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { requireApiKey } from '../middlewares/requireApiKey.js';
import { rateLimit } from '../middlewares/rateLimit.js';
import { resourceService } from '../services/resourceService.js';
import { dependencyService } from '../services/dependencyService.js';
import { findingService } from '../services/findingService.js';
import { awsAccountService } from '../services/awsAccountService.js';
import { orgService } from '../services/orgService.js';
import { HTTP400Error } from '../lib/errors.js';
import type { Variables } from '../types/index.js';

const publicApiRoute = new Hono<{ Variables: Variables }>();

// Permissive CORS for public API (any origin, GET only)
publicApiRoute.use(
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['X-API-Key', 'Content-Type'],
    maxAge: 86400,
  })
);

// API key authentication
publicApiRoute.use(requireApiKey);

// Rate limit: 100 requests per minute per org (fail-closed for API access)
publicApiRoute.use(
  rateLimit({
    keyPrefix: 'public_api',
    maxRequests: 100,
    windowSeconds: 60,
    keyExtractor: (c) => c.get('orgId'),
    message: 'API rate limit exceeded. Maximum 100 requests per minute.',
    failOpen: false,
  })
);

// =============================================================================
// Resources
// =============================================================================

const resourceQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  awsAccountId: z.string().uuid().optional(),
  region: z.string().optional(),
  service: z.string().optional(),
  state: z.string().optional(),
  costFilter: z.enum(['all', 'paid', 'free']).optional(),
});

// GET /api/v1/resources
publicApiRoute.get('/resources', zValidator('query', resourceQuerySchema), async (c) => {
  const orgId = c.get('orgId');
  const filters = c.req.valid('query');
  const result = await resourceService.getResources(orgId, filters);
  // Strip raw provider response from public API
  const safeData = result.data.map(({ raw, ...rest }) => rest);
  return c.json({ ...result, data: safeData });
});

// GET /api/v1/resources/stats
publicApiRoute.get('/resources/stats', async (c) => {
  const orgId = c.get('orgId');
  const stats = await resourceService.getResourceStats(orgId);
  return c.json({ data: stats });
});

// GET /api/v1/resources/regions
publicApiRoute.get('/resources/regions', async (c) => {
  const orgId = c.get('orgId');
  const regions = await resourceService.getDistinctRegions(orgId);
  return c.json({ data: regions });
});

// GET /api/v1/resources/services
publicApiRoute.get('/resources/services', async (c) => {
  const orgId = c.get('orgId');
  const services = await resourceService.getDistinctServices(orgId);
  return c.json({ data: services });
});

// GET /api/v1/resources/:id
publicApiRoute.get('/resources/:id', async (c) => {
  const orgId = c.get('orgId');
  const resourceId = c.req.param('id');

  if (!resourceId || resourceId.length > 128) {
    throw new HTTP400Error('Invalid resource ID format');
  }

  const { raw, ...safeResource } = await resourceService.getResource(orgId, resourceId);
  return c.json({ data: safeResource });
});

// GET /api/v1/resources/:id/dependencies
publicApiRoute.get('/resources/:id/dependencies', async (c) => {
  const orgId = c.get('orgId');
  const resourceId = c.req.param('id');
  const dependencies = await dependencyService.getDependencies(orgId, resourceId);
  return c.json({ data: dependencies });
});

// GET /api/v1/resources/:id/dependents
publicApiRoute.get('/resources/:id/dependents', async (c) => {
  const orgId = c.get('orgId');
  const resourceId = c.req.param('id');
  const dependents = await dependencyService.getDependents(orgId, resourceId);
  return c.json({ data: dependents });
});

// =============================================================================
// Findings
// =============================================================================

const findingQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  awsAccountId: z.string().uuid().optional(),
  resourceId: z.string().uuid().optional(),
  type: z.string().optional(),
  severity: z.enum(['low', 'medium', 'high']).optional(),
  status: z.enum(['open', 'resolved', 'snoozed', 'ignored']).optional(),
});

// GET /api/v1/findings
publicApiRoute.get('/findings', zValidator('query', findingQuerySchema), async (c) => {
  const orgId = c.get('orgId');
  const filters = c.req.valid('query');
  const result = await findingService.getFindings(orgId, filters);
  return c.json(result);
});

// GET /api/v1/findings/stats
publicApiRoute.get('/findings/stats', async (c) => {
  const orgId = c.get('orgId');
  const stats = await findingService.getFindingStats(orgId);
  return c.json({ data: stats });
});

// GET /api/v1/findings/:id
publicApiRoute.get('/findings/:id', async (c) => {
  const orgId = c.get('orgId');
  const findingId = c.req.param('id');
  const finding = await findingService.getFinding(orgId, findingId);
  return c.json({ data: finding });
});

// =============================================================================
// Scans
// =============================================================================

// POST /api/v1/scans/trigger — trigger a scan via API
const triggerScanSchema = z.object({
  accountId: z.string().uuid(),
});

publicApiRoute.post('/scans/trigger', zValidator('json', triggerScanSchema), async (c) => {
  const orgId = c.get('orgId');
  const { accountId } = c.req.valid('json');
  const scan = await awsAccountService.enqueueScan(orgId, accountId);
  return c.json({ data: { scanId: scan.id, status: scan.status } }, 201);
});

// GET /api/v1/scans/active
publicApiRoute.get('/scans/active', async (c) => {
  const orgId = c.get('orgId');
  const activeScans = await awsAccountService.getActiveScans(orgId);
  return c.json({ data: activeScans });
});

// GET /api/v1/scans/recent
publicApiRoute.get('/scans/recent', async (c) => {
  const orgId = c.get('orgId');
  const limitRaw = parseInt(c.req.query('limit') || '10', 10);
  const limit = Math.min(Math.max(isNaN(limitRaw) ? 10 : limitRaw, 1), 100);
  const recentScans = await awsAccountService.getRecentScans(orgId, limit, false);
  return c.json({ data: recentScans });
});

// GET /api/v1/scans/:id — get scan status
publicApiRoute.get('/scans/:id', async (c) => {
  const orgId = c.get('orgId');
  const scanId = c.req.param('id');
  const scan = await awsAccountService.getScan(orgId, scanId);
  return c.json({ data: scan });
});

// =============================================================================
// AWS Accounts
// =============================================================================

// GET /api/v1/accounts
publicApiRoute.get('/accounts', async (c) => {
  const orgId = c.get('orgId');
  const accounts = await awsAccountService.getAccounts(orgId);
  // Strip sensitive AWS IAM credentials from public API response
  const safeAccounts = accounts.map(({ roleArn, externalId, ...rest }) => rest);
  return c.json({ data: safeAccounts });
});

// =============================================================================
// Organization
// =============================================================================

// GET /api/v1/organization
publicApiRoute.get('/organization', async (c) => {
  const orgId = c.get('orgId');
  const org = await orgService.getOrgPublic(orgId);
  return c.json({ data: org });
});

export default publicApiRoute;
