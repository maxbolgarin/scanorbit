import { describe, it, expect, vi, beforeEach } from 'vitest';
import { jsonBody } from '../setup.js';
import { Hono } from 'hono';
import type { Variables } from '../../types/index.js';

// ─── requireApiKey middleware mock ────────────────────────────────────────────
vi.mock('../../middlewares/requireApiKey.js', () => ({
  requireApiKey: vi.fn(async (c: any, next: any) => {
    c.set('orgId', 'test-org-id');
    await next();
  }),
}));

// ─── rateLimit middleware mock (pass-through) ─────────────────────────────────
vi.mock('../../middlewares/rateLimit.js', () => ({
  rateLimit: vi.fn(() => async (_c: any, next: any) => { await next(); }),
  rateLimitByEmailAndIP: vi.fn(() => async (_c: any, next: any) => { await next(); }),
  rateLimiters: {
    login: async (_c: any, next: any) => { await next(); },
    api: async (_c: any, next: any) => { await next(); },
  },
}));

// ─── Service mocks ────────────────────────────────────────────────────────────
const { mockAwsAccountService } = vi.hoisted(() => ({
  mockAwsAccountService: {
    enqueueScan: vi.fn(),
    getScan: vi.fn(),
    getActiveScans: vi.fn(),
    getRecentScans: vi.fn(),
    getAccounts: vi.fn(),
  },
}));

vi.mock('../../services/awsAccountService.js', () => ({
  awsAccountService: mockAwsAccountService,
}));

vi.mock('../../services/resourceService.js', () => ({
  resourceService: {
    getResources: vi.fn(),
    getResourceStats: vi.fn(),
    getDistinctRegions: vi.fn(),
    getDistinctServices: vi.fn(),
    getResource: vi.fn(),
  },
}));

vi.mock('../../services/dependencyService.js', () => ({
  dependencyService: {
    getDependencies: vi.fn(),
    getDependents: vi.fn(),
  },
}));

vi.mock('../../services/findingService.js', () => ({
  findingService: {
    getFindings: vi.fn(),
    getFindingStats: vi.fn(),
    getFinding: vi.fn(),
  },
}));

vi.mock('../../services/orgService.js', () => ({
  orgService: {
    getOrgPublic: vi.fn(),
  },
  getOrgTier: vi.fn(),
  verifyOrgAdmin: vi.fn(),
}));

vi.mock('../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../lib/metrics.js', () => ({
  errorsTotal: { inc: vi.fn() },
}));

// ─── Import route and error handler ──────────────────────────────────────────
import publicApiRoute from '../../routes/publicApi.js';
import { errorHandler } from '../../middlewares/errorHandler.js';
import { requireApiKey } from '../../middlewares/requireApiKey.js';

// ─── Tests ────────────────────────────────────────────────────────────────────
describe('Public API Routes — Scans', () => {
  let app: Hono<{ Variables: Variables }>;

  beforeEach(() => {
    app = new Hono<{ Variables: Variables }>();
    app.route('/api/v1', publicApiRoute);
    app.onError(errorHandler);
    vi.clearAllMocks();
    // Restore requireApiKey mock implementation after vi.clearAllMocks()
    vi.mocked(requireApiKey).mockImplementation(async (c: any, next: any) => {
      c.set('orgId', 'test-org-id');
      await next();
    });
  });

  // ─── POST /api/v1/scans/trigger ───────────────────────────────────────────
  describe('POST /api/v1/scans/trigger', () => {
    it('returns 201 with scanId and status when successful', async () => {
      const accountId = '550e8400-e29b-41d4-a716-446655440000';
      mockAwsAccountService.enqueueScan.mockResolvedValue({
        id: 'scan-abc-123',
        status: 'queued',
      });

      const res = await app.request('/api/v1/scans/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      });

      expect(res.status).toBe(201);
      const body = await jsonBody(res);
      expect(body.data.scanId).toBe('scan-abc-123');
      expect(body.data.status).toBe('queued');
      expect(mockAwsAccountService.enqueueScan).toHaveBeenCalledWith('test-org-id', accountId);
    });

    it('returns 400 with invalid body (missing accountId)', async () => {
      const res = await app.request('/api/v1/scans/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
    });

    it('returns 400 with invalid UUID', async () => {
      const res = await app.request('/api/v1/scans/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: 'not-a-uuid' }),
      });

      expect(res.status).toBe(400);
    });
  });

  // ─── GET /api/v1/scans/:id ─────────────────────────────────────────────────
  describe('GET /api/v1/scans/:id', () => {
    it('returns scan data', async () => {
      const scanId = '550e8400-e29b-41d4-a716-446655440001';
      const mockScan = {
        id: scanId,
        orgId: 'test-org-id',
        status: 'completed',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      };
      mockAwsAccountService.getScan.mockResolvedValue(mockScan);

      const res = await app.request(`/api/v1/scans/${scanId}`);

      expect(res.status).toBe(200);
      const body = await jsonBody(res);
      expect(body.data.id).toBe(scanId);
      expect(body.data.status).toBe('completed');
      expect(mockAwsAccountService.getScan).toHaveBeenCalledWith('test-org-id', scanId);
    });

    it('returns 404 for nonexistent scan', async () => {
      const { HTTP404Error } = await import('../../lib/errors.js');
      mockAwsAccountService.getScan.mockRejectedValue(new HTTP404Error('Scan not found'));

      const res = await app.request('/api/v1/scans/nonexistent-scan-id');

      expect(res.status).toBe(404);
    });
  });
});
