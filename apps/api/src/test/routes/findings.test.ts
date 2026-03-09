import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { Variables } from '../../types/index.js';
import { createFinding } from '../helpers/factories.js';

// Mock all dependencies
vi.mock('../../middlewares/auth.js', () => ({
  requireAuth: vi.fn(async (c: any, next: any) => {
    c.set('userId', 'test-user-id');
    c.set('orgId', 'test-org-id');
    await next();
  }),
}));

vi.mock('../../middlewares/requireOrgId.js', () => ({
  requireOrgId: vi.fn(async (_c: any, next: any) => { await next(); }),
}));

vi.mock('../../middlewares/processingRestriction.js', () => ({
  requireNoProcessingRestriction: vi.fn(async (_c: any, next: any) => { await next(); }),
}));

const { mockFindingService, mockGetOrgTier } = vi.hoisted(() => ({
  mockFindingService: {
    getFindings: vi.fn(),
    getFinding: vi.fn(),
    updateFinding: vi.fn(),
    bulkUpdateStatus: vi.fn(),
    getFindingStats: vi.fn(),
    getFindingHistory: vi.fn(),
    getResourceHealth: vi.fn(),
    getResourceFindingTimeline: vi.fn(),
  },
  mockGetOrgTier: vi.fn().mockResolvedValue('pro'),
}));

vi.mock('../../services/findingService.js', () => ({
  findingService: mockFindingService,
}));

vi.mock('../../services/orgService.js', () => ({
  getOrgTier: (...args: unknown[]) => mockGetOrgTier(...args),
}));

vi.mock('../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../lib/metrics.js', () => ({
  errorsTotal: { inc: vi.fn() },
}));

import findingsRoute from '../../routes/findings.js';
import { errorHandler } from '../../middlewares/errorHandler.js';

describe('Findings Routes', () => {
  let app: Hono<{ Variables: Variables }>;

  beforeEach(() => {
    app = new Hono<{ Variables: Variables }>();
    app.route('/findings', findingsRoute);
    app.onError(errorHandler);
    vi.clearAllMocks();
    mockGetOrgTier.mockResolvedValue('pro');
  });

  describe('GET /findings', () => {
    it('returns paginated findings for pro tier', async () => {
      const findings = [createFinding(), createFinding()];
      mockFindingService.getFindings.mockResolvedValue({
        data: findings,
        pagination: { page: 1, limit: 50, total: 2, totalPages: 1 },
      });

      const res = await app.request('/findings');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toHaveLength(2);
      expect(body.pagination.total).toBe(2);
    });

    it('returns 403 for free tier', async () => {
      mockGetOrgTier.mockResolvedValue('free');

      const res = await app.request('/findings');
      expect(res.status).toBe(403);
    });

    it('passes query filters to service', async () => {
      mockFindingService.getFindings.mockResolvedValue({
        data: [],
        pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
      });

      await app.request('/findings?severity=high&status=open&page=2');

      expect(mockFindingService.getFindings).toHaveBeenCalledWith(
        'test-org-id',
        expect.objectContaining({ severity: 'high', status: 'open', page: 2 })
      );
    });

    it('rejects invalid severity value', async () => {
      const res = await app.request('/findings?severity=critical');
      expect(res.status).toBe(400);
    });
  });

  describe('GET /findings/stats', () => {
    it('returns finding statistics', async () => {
      const stats = { total: 10, open: 5, resolved: 3, snoozed: 2 };
      mockFindingService.getFindingStats.mockResolvedValue(stats);

      const res = await app.request('/findings/stats');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toEqual(stats);
    });
  });

  describe('GET /findings/:id', () => {
    it('returns finding details', async () => {
      const finding = createFinding();
      mockFindingService.getFinding.mockResolvedValue(finding);

      const res = await app.request('/findings/some-id');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toBeDefined();
    });
  });

  describe('PATCH /findings/:id', () => {
    it('updates finding status', async () => {
      const finding = createFinding({ status: 'resolved' });
      mockFindingService.updateFinding.mockResolvedValue(finding);

      const res = await app.request('/findings/some-id', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'resolved' }),
      });

      expect(res.status).toBe(200);
      expect(mockFindingService.updateFinding).toHaveBeenCalledWith(
        'test-org-id',
        'some-id',
        expect.objectContaining({ status: 'resolved' })
      );
    });

    it('rejects invalid status', async () => {
      const res = await app.request('/findings/some-id', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'invalid' }),
      });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /findings/bulk-update', () => {
    it('bulk updates findings', async () => {
      mockFindingService.bulkUpdateStatus.mockResolvedValue(3);

      const res = await app.request('/findings/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          findingIds: [crypto.randomUUID(), crypto.randomUUID()],
          status: 'resolved',
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.updatedCount).toBe(3);
    });

    it('rejects empty findingIds', async () => {
      const res = await app.request('/findings/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ findingIds: [], status: 'resolved' }),
      });
      expect(res.status).toBe(400);
    });

    it('rejects non-uuid findingIds', async () => {
      const res = await app.request('/findings/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ findingIds: ['not-a-uuid'], status: 'resolved' }),
      });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /findings/:id/history', () => {
    it('returns finding history', async () => {
      const history = [{ scanId: 'scan-1', status: 'detected' }];
      mockFindingService.getFindingHistory.mockResolvedValue(history);

      const res = await app.request('/findings/some-id/history');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toEqual(history);
    });
  });
});
