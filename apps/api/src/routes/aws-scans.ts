import { Hono } from 'hono';
import { requireAuth } from '../middlewares/auth.js';
import { requireOrgId } from '../middlewares/requireOrgId.js';
import { awsAccountService } from '../services/awsAccountService.js';
import type { Variables } from '../types/index.js';

const awsScansRoute = new Hono<{ Variables: Variables }>();

// All routes require authentication and org context
awsScansRoute.use(requireAuth);
awsScansRoute.use(requireOrgId);

// GET /aws/scans/active - Get active scans (pending or running)
awsScansRoute.get('/active', async (c) => {
  const orgId = c.get('orgId');
  const activeScans = await awsAccountService.getActiveScans(orgId);
  return c.json({ data: activeScans });
});

// GET /aws/scans/recent - Get recent scans (filters out archived by default)
awsScansRoute.get('/recent', async (c) => {
  const orgId = c.get('orgId');

  const limitRaw = parseInt(c.req.query('limit') || '10', 10);
  // Validate limit: must be between 1 and 100, default to 10 if invalid
  const limit = Math.min(Math.max(isNaN(limitRaw) ? 10 : limitRaw, 1), 100);
  // Parse includeArchived: includes canceled scans and scans without a key
  const includeArchived = c.req.query('includeArchived') === 'true';

  const recentScans = await awsAccountService.getRecentScans(orgId, limit, includeArchived);
  return c.json({ data: recentScans });
});

// GET /aws/scans/:scanId - Get specific scan details
awsScansRoute.get('/:scanId', async (c) => {
  const orgId = c.get('orgId');
  const scanId = c.req.param('scanId');
  const scan = await awsAccountService.getScan(orgId, scanId);
  return c.json({ data: scan });
});

export default awsScansRoute;
