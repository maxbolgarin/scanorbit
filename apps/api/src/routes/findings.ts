import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { requireAuth } from '../middlewares/auth.js';
import { findingService } from '../services/findingService.js';
import { HTTP400Error } from '../lib/errors.js';
import type { Variables, FindingStatus } from '../types/index.js';

const findingsRoute = new Hono<{ Variables: Variables }>();

// All routes require authentication
findingsRoute.use(requireAuth);

// Validation schemas
const querySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  awsAccountId: z.string().uuid().optional(),
  type: z.string().optional(),
  severity: z.enum(['low', 'medium', 'high']).optional(),
  status: z.enum(['open', 'resolved', 'snoozed', 'ignored']).optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(['open', 'resolved', 'snoozed', 'ignored']),
  snoozedUntil: z.coerce.date().optional(),
});

const bulkUpdateSchema = z.object({
  findingIds: z.array(z.string().uuid()).min(1).max(100),
  status: z.enum(['open', 'resolved', 'snoozed', 'ignored']),
});

// GET /findings - List findings with filters
findingsRoute.get('/', zValidator('query', querySchema), async (c) => {
  const orgId = c.get('orgId');

  if (!orgId) {
    throw new HTTP400Error('No organization selected');
  }

  const filters = c.req.valid('query');
  const result = await findingService.getFindings(orgId, filters);
  return c.json(result);
});

// GET /findings/stats - Get finding statistics
findingsRoute.get('/stats', async (c) => {
  const orgId = c.get('orgId');

  if (!orgId) {
    throw new HTTP400Error('No organization selected');
  }

  const stats = await findingService.getFindingStats(orgId);
  return c.json({ data: stats });
});

// POST /findings/bulk-update - Bulk update finding status
findingsRoute.post(
  '/bulk-update',
  zValidator('json', bulkUpdateSchema),
  async (c) => {
    const orgId = c.get('orgId');

    if (!orgId) {
      throw new HTTP400Error('No organization selected');
    }

    const { findingIds, status } = c.req.valid('json');
    const updatedCount = await findingService.bulkUpdateStatus(
      orgId,
      findingIds,
      status as FindingStatus
    );
    return c.json({ data: { updatedCount } });
  }
);

// GET /findings/:id - Get finding details
findingsRoute.get('/:id', async (c) => {
  const orgId = c.get('orgId');
  const findingId = c.req.param('id');

  if (!orgId) {
    throw new HTTP400Error('No organization selected');
  }

  const finding = await findingService.getFinding(orgId, findingId);
  return c.json({ data: finding });
});

// PATCH /findings/:id - Update finding status
findingsRoute.patch(
  '/:id',
  zValidator('json', updateStatusSchema),
  async (c) => {
    const orgId = c.get('orgId');
    const findingId = c.req.param('id');

    if (!orgId) {
      throw new HTTP400Error('No organization selected');
    }

    const data = c.req.valid('json');
    const finding = await findingService.updateFinding(orgId, findingId, {
      status: data.status as FindingStatus,
      snoozedUntil: data.snoozedUntil,
    });
    return c.json({ data: finding });
  }
);

export default findingsRoute;
