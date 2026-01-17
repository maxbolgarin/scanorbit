import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, and, desc } from 'drizzle-orm';
import { requireAuth } from '../middlewares/auth.js';
import { resourceService } from '../services/resourceService.js';
import { dependencyService } from '../services/dependencyService.js';
import { findingService } from '../services/findingService.js';
import { HTTP400Error } from '../lib/errors.js';
import { db } from '../lib/db.js';
import { resourceScans, scans, resources } from '../db/schema.js';
import type { Variables } from '../types/index.js';

const resourcesRoute = new Hono<{ Variables: Variables }>();

// All routes require authentication
resourcesRoute.use(requireAuth);

// Validation schemas
const querySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  awsAccountId: z.string().uuid().optional(),
  region: z.string().optional(),
  service: z.string().optional(),
  state: z.string().optional(),
  costFilter: z.enum(['all', 'paid', 'free']).optional(),
});

const updateTagsSchema = z.object({
  tags: z.record(z.string()),
});

// GET /resources - List resources with filters
resourcesRoute.get('/', zValidator('query', querySchema), async (c) => {
  const orgId = c.get('orgId');

  if (!orgId) {
    throw new HTTP400Error('No organization selected');
  }

  const filters = c.req.valid('query');
  const result = await resourceService.getResources(orgId, filters);
  return c.json(result);
});

// GET /resources/stats - Get resource statistics
resourcesRoute.get('/stats', async (c) => {
  const orgId = c.get('orgId');

  if (!orgId) {
    throw new HTTP400Error('No organization selected');
  }

  const stats = await resourceService.getResourceStats(orgId);
  return c.json({ data: stats });
});

// GET /resources/regions - Get distinct regions
resourcesRoute.get('/regions', async (c) => {
  const orgId = c.get('orgId');

  if (!orgId) {
    throw new HTTP400Error('No organization selected');
  }

  const regions = await resourceService.getDistinctRegions(orgId);
  return c.json({ data: regions });
});

// GET /resources/services - Get distinct services
resourcesRoute.get('/services', async (c) => {
  const orgId = c.get('orgId');

  if (!orgId) {
    throw new HTTP400Error('No organization selected');
  }

  const services = await resourceService.getDistinctServices(orgId);
  return c.json({ data: services });
});

// GET /resources/dependencies/all - Get all dependencies for graph visualization
resourcesRoute.get('/dependencies/all', async (c) => {
  const orgId = c.get('orgId');

  if (!orgId) {
    throw new HTTP400Error('No organization selected');
  }

  const dependencies = await dependencyService.getAllDependencies(orgId);
  return c.json({ data: dependencies });
});

// GET /resources/dependencies/stats - Get dependency statistics
resourcesRoute.get('/dependencies/stats', async (c) => {
  const orgId = c.get('orgId');

  if (!orgId) {
    throw new HTTP400Error('No organization selected');
  }

  const stats = await dependencyService.getDependencyStats(orgId);
  return c.json({ data: stats });
});

// GET /resources/:id - Get resource details
resourcesRoute.get('/:id', async (c) => {
  const orgId = c.get('orgId');
  const resourceId = c.req.param('id');

  if (!orgId) {
    throw new HTTP400Error('No organization selected');
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
    const resourceId = c.req.param('id');

    if (!orgId) {
      throw new HTTP400Error('No organization selected');
    }

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

  if (!orgId) {
    throw new HTTP400Error('No organization selected');
  }

  const dependencies = await dependencyService.getDependencies(orgId, resourceId);
  return c.json({ data: dependencies });
});

// GET /resources/:id/dependents - Get dependents (incoming relationships) for a resource
resourcesRoute.get('/:id/dependents', async (c) => {
  const orgId = c.get('orgId');
  const resourceId = c.req.param('id');

  if (!orgId) {
    throw new HTTP400Error('No organization selected');
  }

  const dependents = await dependencyService.getDependents(orgId, resourceId);
  return c.json({ data: dependents });
});

// GET /resources/:id/scan-history - Get scan history for a resource
resourcesRoute.get('/:id/scan-history', async (c) => {
  const orgId = c.get('orgId');
  const resourceId = c.req.param('id');

  if (!orgId) {
    throw new HTTP400Error('No organization selected');
  }

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

  if (!orgId) {
    throw new HTTP400Error('No organization selected');
  }

  const timeline = await findingService.getResourceFindingTimeline(orgId, resourceId);
  return c.json({ data: timeline });
});

export default resourcesRoute;
