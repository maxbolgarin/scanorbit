import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { requireAuth } from '../middlewares/auth.js';
import { requireOrgId } from '../middlewares/requireOrgId.js';
import { requireNoProcessingRestriction } from '../middlewares/processingRestriction.js';
import { findingService } from '../services/findingService.js';
import { HTTP403Error } from '../lib/errors.js';
import { TIER_LIMITS, type Variables, type FindingStatus } from '../types/index.js';
import { getOrgTier } from '../services/orgService.js';

const findingsRoute = new Hono<{ Variables: Variables }>();

// All routes require authentication and org context
findingsRoute.use(requireAuth);
findingsRoute.use(requireOrgId);
// Block write operations when GDPR processing restriction is active (Article 18)
findingsRoute.use('*', async (c, next) => {
  if (c.req.method !== 'GET') {
    return requireNoProcessingRestriction(c, next);
  }
  await next();
});

// Validation schemas
const querySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  awsAccountId: z.string().uuid().optional(),
  resourceId: z.string().uuid().optional(),
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

  // Check tier-based access (safely handles missing column)
  const tier = await getOrgTier(orgId);
  if (!TIER_LIMITS[tier].canViewFindingList) {
    throw new HTTP403Error('Finding list is not available on the Free tier. Upgrade to Pro for full access.');
  }

  const filters = c.req.valid('query');
  const result = await findingService.getFindings(orgId, filters);
  return c.json(result);
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

// GET /findings/export - Export all findings as CSV or JSON (Team-only)
findingsRoute.get('/export', zValidator('query', z.object({
  format: z.enum(['csv', 'json']).default('csv'),
  awsAccountId: z.string().uuid().optional(),
  status: z.enum(['open', 'resolved', 'snoozed', 'ignored']).optional(),
  type: z.string().optional(),
  severity: z.enum(['low', 'medium', 'high']).optional(),
})), async (c) => {
  const orgId = c.get('orgId');
  const tier = await getOrgTier(orgId);

  if (!TIER_LIMITS[tier].canExportData) {
    throw new HTTP403Error('Data export is available on the Team plan only. Upgrade to Team for CSV/JSON exports.');
  }

  const { format, awsAccountId, status, type, severity } = c.req.valid('query');

  // Single query with hard cap to prevent unbounded memory usage
  const result = await findingService.getFindings(orgId, {
    awsAccountId,
    status: status as any,
    type,
    severity,
    page: 1,
    limit: MAX_EXPORT_ROWS,
  });
  const allFindings = result.data;

  if (format === 'json') {
    c.header('Content-Disposition', 'attachment; filename="scanorbit-findings.json"');
    return c.json({ data: allFindings, total: allFindings.length });
  }

  // CSV format with formula injection protection
  const csvHeaders = ['ID', 'AWS Account ID', 'Resource ID', 'Type', 'Severity', 'Status', 'Summary', 'First Detected', 'Last Detected', 'Detection Count', 'Resolved At', 'Created At'];
  const csvRows = allFindings.map(f => [
    sanitizeCsvCell(f.id),
    sanitizeCsvCell(f.awsAccountId),
    sanitizeCsvCell(f.resourceId ?? ''),
    sanitizeCsvCell(f.type),
    sanitizeCsvCell(f.severity),
    sanitizeCsvCell(f.status),
    sanitizeCsvCell(f.summary ?? ''),
    sanitizeCsvCell(String(f.firstDetectedAt ?? '')),
    sanitizeCsvCell(String(f.lastDetectedAt ?? '')),
    sanitizeCsvCell(String(f.detectionCount ?? 0)),
    sanitizeCsvCell(String(f.resolvedAt ?? '')),
    sanitizeCsvCell(String(f.createdAt)),
  ].join(','));

  const csv = [csvHeaders.join(','), ...csvRows].join('\n');
  c.header('Content-Type', 'text/csv; charset=utf-8');
  c.header('Content-Disposition', 'attachment; filename="scanorbit-findings.csv"');
  return c.body(csv);
});

// GET /findings/stats - Get finding statistics
findingsRoute.get('/stats', async (c) => {
  const orgId = c.get('orgId');
  const stats = await findingService.getFindingStats(orgId);
  return c.json({ data: stats });
});

// POST /findings/bulk-update - Bulk update finding status
findingsRoute.post(
  '/bulk-update',
  zValidator('json', bulkUpdateSchema),
  async (c) => {
    const orgId = c.get('orgId');
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
    const data = c.req.valid('json');
    const finding = await findingService.updateFinding(orgId, findingId, {
      status: data.status as FindingStatus,
      snoozedUntil: data.snoozedUntil,
    });
    return c.json({ data: finding });
  }
);

// GET /findings/:id/history - Get finding detection history
findingsRoute.get('/:id/history', async (c) => {
  const orgId = c.get('orgId');
  const findingId = c.req.param('id');
  const history = await findingService.getFindingHistory(orgId, findingId);
  return c.json({ data: history });
});

export default findingsRoute;
