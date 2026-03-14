import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { requireAuth } from '../middlewares/auth.js';
import { rateLimit } from '../middlewares/rateLimit.js';
import { bugReportService } from '../services/bugReportService.js';
import type { Variables } from '../types/index.js';

const bugReportsRoute = new Hono<{ Variables: Variables }>();

bugReportsRoute.use(requireAuth);

const createBugReportSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(255),
  description: z.string().min(10, 'Description must be at least 10 characters').max(5000),
  category: z.enum(['ui_bug', 'scan_issue', 'data_incorrect', 'performance', 'feature_request', 'other']),
  screenshotUrl: z.string().url().max(500).optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
});

bugReportsRoute.post(
  '/',
  rateLimit({
    keyPrefix: 'bugreport',
    maxRequests: 5,
    windowSeconds: 60 * 60,
    message: 'Too many bug reports. Please try again later.',
    failOpen: true,
    keyExtractor: (c) => c.get('userId'),
  }),
  zValidator('json', createBugReportSchema),
  async (c) => {
    const userId = c.get('userId');
    const orgId = c.get('orgId');
    const data = c.req.valid('json');

    const report = await bugReportService.create(orgId, userId, data);
    return c.json({ data: report }, 201);
  }
);

export default bugReportsRoute;
