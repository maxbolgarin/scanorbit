import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { requireAuth } from '../middlewares/auth.js';
import { requireOrgId } from '../middlewares/requireOrgId.js';
import { findingService } from '../services/findingService.js';
import type { Variables, FindingStatus } from '../types/index.js';
import { verifyOrgAdmin } from '../services/orgService.js';

const findingsRoute = new Hono<{ Variables: Variables }>();

// All routes require authentication and org context
findingsRoute.use(requireAuth);
findingsRoute.use(requireOrgId);

// Validation schemas
const querySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  awsAccountId: z.string().uuid().optional(),
  resourceId: z.string().uuid().optional(),
  type: z.string().optional(),
  severity: z.enum(['low', 'medium', 'high']).optional(),
  status: z.enum(['open', 'resolved', 'snoozed', 'ignored']).optional(),
  sortBy: z.enum(['createdAt', 'updatedAt']).optional(),
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

// Format date compactly for CSV: "2026-03-14 08:54:04 UTC"
function formatCsvDate(value: Date | string | null | undefined): string {
  if (!value) return '';
  const d = new Date(value as any);
  if (isNaN(d.getTime())) return String(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`;
}

// GET /findings/export - Export all findings as CSV or JSON
findingsRoute.get('/export', zValidator('query', z.object({
  format: z.enum(['csv', 'json']).default('csv'),
  awsAccountId: z.string().uuid().optional(),
  status: z.enum(['open', 'resolved', 'snoozed', 'ignored']).optional(),
  type: z.string().optional(),
  severity: z.enum(['low', 'medium', 'high']).optional(),
})), async (c) => {
  const orgId = c.get('orgId');
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
    sanitizeCsvCell(formatCsvDate(f.firstDetectedAt)),
    sanitizeCsvCell(formatCsvDate(f.lastDetectedAt)),
    sanitizeCsvCell(String(f.detectionCount ?? 0)),
    sanitizeCsvCell(formatCsvDate(f.resolvedAt)),
    sanitizeCsvCell(formatCsvDate(f.createdAt)),
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
    const userId = c.get('userId');
    await verifyOrgAdmin(orgId, userId);
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
    const userId = c.get('userId');
    await verifyOrgAdmin(orgId, userId);
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
