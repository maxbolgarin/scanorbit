import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { requireAuth } from '../middlewares/auth.js';
import { resourceService } from '../services/resourceService.js';
import { HTTP400Error } from '../lib/errors.js';
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

export default resourcesRoute;
