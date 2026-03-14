import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, and, desc } from 'drizzle-orm';
import { requireAuth } from '../middlewares/auth.js';
import { requireOrgId } from '../middlewares/requireOrgId.js';
import { resourceService } from '../services/resourceService.js';
import { dependencyService } from '../services/dependencyService.js';
import { findingService } from '../services/findingService.js';
import { HTTP400Error, HTTP403Error } from '../lib/errors.js';
import { db } from '../lib/db.js';
import { resourceScans, scans, resources } from '../db/schema.js';
import { TIER_LIMITS, type Variables } from '../types/index.js';
import { getOrgTier, verifyOrgAdmin } from '../services/orgService.js';

const resourcesRoute = new Hono<{ Variables: Variables }>();

// All routes require authentication and org context
resourcesRoute.use(requireAuth);
resourcesRoute.use(requireOrgId);

// Validation schemas
const querySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  awsAccountId: z.string().uuid().optional(),
  region: z.string().optional(),
  service: z.string().optional(),
  state: z.string().optional(),
  costFilter: z.enum(['all', 'paid', 'free']).optional(),
  health: z.enum(['healthy', 'warning', 'critical', 'orphaned']).optional(),
});

// Tag validation limits
const MAX_TAGS = 50;
const MAX_TAG_KEY_LENGTH = 128;
const MAX_TAG_VALUE_LENGTH = 256;

const updateTagsSchema = z.object({
  tags: z
    .record(
      z.string().min(1, 'Tag key cannot be empty').max(MAX_TAG_KEY_LENGTH, `Tag key must be at most ${MAX_TAG_KEY_LENGTH} characters`),
      z.string().max(MAX_TAG_VALUE_LENGTH, `Tag value must be at most ${MAX_TAG_VALUE_LENGTH} characters`)
    )
    .refine(
      (obj) => Object.keys(obj).length <= MAX_TAGS,
      `Maximum ${MAX_TAGS} tags allowed`
    )
    .refine(
      (obj) => Object.keys(obj).every(key => /^[a-zA-Z0-9_:-]+$/.test(key)),
      'Tag keys must be alphanumeric with underscores, hyphens, and colons only'
    ),
});

// GET /resources - List resources with filters
resourcesRoute.get('/', zValidator('query', querySchema), async (c) => {
  const orgId = c.get('orgId');


  // Check tier-based access (safely handles missing column)
  const tier = await getOrgTier(orgId);
  if (!TIER_LIMITS[tier].canViewResourceList) {
    throw new HTTP403Error('Resource list is not available on the Free tier. Upgrade to Pro for full access.');
  }

  const filters = c.req.valid('query');
  const result = await resourceService.getResources(orgId, filters);
  return c.json(result);
});

// GET /resources/stats - Get resource statistics
resourcesRoute.get('/stats', async (c) => {
  const orgId = c.get('orgId');


  const stats = await resourceService.getResourceStats(orgId);
  return c.json({ data: stats });
});

// GET /resources/health - Get resource health based on findings
// Available to all tiers (doesn't expose finding details)
resourcesRoute.get('/health', async (c) => {
  const orgId = c.get('orgId');
  const awsAccountId = c.req.query('awsAccountId');


  const health = await findingService.getResourceHealth(orgId, awsAccountId);
  return c.json({ data: health });
});

// GET /resources/regions - Get distinct regions
resourcesRoute.get('/regions', async (c) => {
  const orgId = c.get('orgId');


  const regions = await resourceService.getDistinctRegions(orgId);
  return c.json({ data: regions });
});

// GET /resources/services - Get distinct services
resourcesRoute.get('/services', async (c) => {
  const orgId = c.get('orgId');


  const services = await resourceService.getDistinctServices(orgId);
  return c.json({ data: services });
});

// Hard cap for export to prevent OOM on large datasets
const MAX_EXPORT_ROWS = 10_000;

// Sanitize CSV cell to prevent formula injection in spreadsheet tools
function sanitizeCsvCell(value: string): string {
  const escaped = value.replace(/"/g, '""');
  if (/^[=+\-@\t]/.test(escaped)) {
    return `"'${escaped}"`;
  }
  return `"${escaped}"`;
}

// GET /resources/export - Export all resources as CSV or JSON (Team-only)
resourcesRoute.get('/export', zValidator('query', z.object({
  format: z.enum(['csv', 'json']).default('csv'),
  awsAccountId: z.string().uuid().optional(),
  region: z.string().optional(),
  service: z.string().optional(),
  state: z.string().optional(),
})), async (c) => {
  const orgId = c.get('orgId');
  const tier = await getOrgTier(orgId);

  if (!TIER_LIMITS[tier].canExportData) {
    throw new HTTP403Error('Data export is available on the Team plan only. Upgrade to Team for CSV/JSON exports.');
  }

  const { format, awsAccountId, region, service, state } = c.req.valid('query');

  // Single query with hard cap to prevent unbounded memory usage
  const result = await resourceService.getResources(orgId, {
    awsAccountId,
    region,
    service,
    state,
    page: 1,
    limit: MAX_EXPORT_ROWS,
  });
  const allResources = result.data;

  if (format === 'json') {
    c.header('Content-Disposition', 'attachment; filename="scanorbit-resources.json"');
    return c.json({ data: allResources, total: allResources.length });
  }

  // CSV format with formula injection protection
  const csvHeaders = ['ID', 'AWS Account ID', 'Resource ID', 'Service', 'Region', 'Name', 'State', 'Cost Estimate (Monthly)', 'Last Seen At', 'Created At'];
  const csvRows = allResources.map(r => [
    sanitizeCsvCell(r.id),
    sanitizeCsvCell(r.awsAccountId),
    sanitizeCsvCell(r.resourceId),
    sanitizeCsvCell(r.service),
    sanitizeCsvCell(r.region ?? ''),
    sanitizeCsvCell(r.name ?? ''),
    sanitizeCsvCell(r.state ?? ''),
    sanitizeCsvCell(String(r.costEstimateMonthly ?? '')),
    sanitizeCsvCell(String(r.lastSeenAt)),
    sanitizeCsvCell(String(r.createdAt)),
  ].join(','));

  const csv = [csvHeaders.join(','), ...csvRows].join('\n');
  c.header('Content-Type', 'text/csv; charset=utf-8');
  c.header('Content-Disposition', 'attachment; filename="scanorbit-resources.csv"');
  return c.body(csv);
});

// GET /resources/dependencies/all - Get all dependencies for graph visualization
resourcesRoute.get('/dependencies/all', async (c) => {
  const orgId = c.get('orgId');


  // Check tier-based access (infrastructure map) - safely handles missing column
  const tier = await getOrgTier(orgId);
  if (!TIER_LIMITS[tier].canViewInfrastructureMap) {
    throw new HTTP403Error('Infrastructure map is not available on the Free tier. Upgrade to Pro for full access.');
  }

  const dependencies = await dependencyService.getAllDependencies(orgId);
  return c.json({ data: dependencies });
});

// GET /resources/dependencies/stats - Get dependency statistics
resourcesRoute.get('/dependencies/stats', async (c) => {
  const orgId = c.get('orgId');


  const stats = await dependencyService.getDependencyStats(orgId);
  return c.json({ data: stats });
});

// GET /resources/:id - Get resource details
resourcesRoute.get('/:id', async (c) => {
  const orgId = c.get('orgId');
  const resourceId = c.req.param('id');

  if (!resourceId || resourceId.length > 128) {
    throw new HTTP400Error('Invalid resource ID format');
  }

  const resource = await resourceService.getResource(orgId, resourceId);
  return c.json({ data: resource });
});

// PATCH /resources/:id - Update resource tags
resourcesRoute.patch(
  '/:id',
  zValidator('json', updateTagsSchema),
  async (c) => {
    const orgId = c.get('orgId');
    const userId = c.get('userId');
    await verifyOrgAdmin(orgId, userId);
    const resourceId = c.req.param('id');

    const data = c.req.valid('json');
    const resource = await resourceService.updateResourceTags(
      orgId,
      resourceId,
      data
    );
    return c.json({ data: resource });
  }
);

// GET /resources/:id/dependencies - Get dependencies (outgoing relationships) for a resource
resourcesRoute.get('/:id/dependencies', async (c) => {
  const orgId = c.get('orgId');
  const resourceId = c.req.param('id');


  const dependencies = await dependencyService.getDependencies(orgId, resourceId);
  return c.json({ data: dependencies });
});

// GET /resources/:id/dependents - Get dependents (incoming relationships) for a resource
resourcesRoute.get('/:id/dependents', async (c) => {
  const orgId = c.get('orgId');
  const resourceId = c.req.param('id');


  const dependents = await dependencyService.getDependents(orgId, resourceId);
  return c.json({ data: dependents });
});

// GET /resources/:id/scan-history - Get scan history for a resource
resourcesRoute.get('/:id/scan-history', async (c) => {
  const orgId = c.get('orgId');
  const resourceId = c.req.param('id');


  // Verify resource belongs to org and get scan history
  const history = await db
    .select({
      id: resourceScans.id,
      scanId: resourceScans.scanId,
      status: resourceScans.status,
      createdAt: resourceScans.createdAt,
      scanStartedAt: scans.startedAt,
      scanCompletedAt: scans.completedAt,
      scanStatus: scans.status,
      resourcesDiscovered: scans.resourcesDiscovered,
      resourcesDelta: scans.resourcesDelta,
    })
    .from(resourceScans)
    .innerJoin(scans, eq(resourceScans.scanId, scans.id))
    .innerJoin(resources, eq(resourceScans.resourceId, resources.id))
    .where(and(
      eq(resourceScans.resourceId, resourceId),
      eq(resources.orgId, orgId)
    ))
    .orderBy(desc(resourceScans.createdAt))
    .limit(50);

  return c.json({ data: history });
});

// GET /resources/:id/finding-timeline - Get finding history for a resource
resourcesRoute.get('/:id/finding-timeline', async (c) => {
  const orgId = c.get('orgId');
  const resourceId = c.req.param('id');


  const timeline = await findingService.getResourceFindingTimeline(orgId, resourceId);
  return c.json({ data: timeline });
});

export default resourcesRoute;
