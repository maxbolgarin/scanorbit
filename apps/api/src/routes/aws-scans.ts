import { Hono } from 'hono';
import { requireAuth } from '../middlewares/auth.js';
import { awsAccountService } from '../services/awsAccountService.js';
import { HTTP400Error } from '../lib/errors.js';
import type { Variables } from '../types/index.js';

const awsScansRoute = new Hono<{ Variables: Variables }>();

// All routes require authentication
awsScansRoute.use(requireAuth);

// GET /aws/scans/active - Get active scans (pending or running)
awsScansRoute.get('/active', async (c) => {
  const orgId = c.get('orgId');

  if (!orgId) {
    throw new HTTP400Error('No organization selected');
  }

  const activeScans = await awsAccountService.getActiveScans(orgId);
  return c.json({ data: activeScans });
});

// GET /aws/scans/recent - Get recent scans (all statuses)
awsScansRoute.get('/recent', async (c) => {
  const orgId = c.get('orgId');

  if (!orgId) {
    throw new HTTP400Error('No organization selected');
  }

  const limit = parseInt(c.req.query('limit') || '10', 10);
  const recentScans = await awsAccountService.getRecentScans(orgId, limit);
  return c.json({ data: recentScans });
});

// GET /aws/scans/:scanId - Get specific scan details
awsScansRoute.get('/:scanId', async (c) => {
  const orgId = c.get('orgId');
  const scanId = c.req.param('scanId');

  if (!orgId) {
    throw new HTTP400Error('No organization selected');
  }

  const scan = await awsAccountService.getScan(orgId, scanId);
  return c.json({ data: scan });
});

export default awsScansRoute;
