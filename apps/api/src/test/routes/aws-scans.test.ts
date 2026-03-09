import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { Variables } from '../../types/index.js';
import { createScan } from '../helpers/factories.js';

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

const { mockAwsAccountService } = vi.hoisted(() => ({
  mockAwsAccountService: {
    getActiveScans: vi.fn(),
    getRecentScans: vi.fn(),
    getScan: vi.fn(),
  },
}));

vi.mock('../../services/awsAccountService.js', () => ({
  awsAccountService: mockAwsAccountService,
}));

vi.mock('../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../lib/metrics.js', () => ({
  errorsTotal: { inc: vi.fn() },
}));

import awsScansRoute from '../../routes/aws-scans.js';
import { errorHandler } from '../../middlewares/errorHandler.js';

describe('AWS Scans Routes', () => {
  let app: Hono<{ Variables: Variables }>;

  beforeEach(() => {
    app = new Hono<{ Variables: Variables }>();
    app.route('/aws/scans', awsScansRoute);
    app.onError(errorHandler);
    vi.clearAllMocks();
  });

  describe('GET /aws/scans/active', () => {
    it('returns active scans', async () => {
      const scans = [createScan({ status: 'running' })];
      mockAwsAccountService.getActiveScans.mockResolvedValue(scans);

      const res = await app.request('/aws/scans/active');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toHaveLength(1);
    });
  });

  describe('GET /aws/scans/recent', () => {
    it('returns recent scans with default limit', async () => {
      mockAwsAccountService.getRecentScans.mockResolvedValue([]);

      const res = await app.request('/aws/scans/recent');
      expect(res.status).toBe(200);
      expect(mockAwsAccountService.getRecentScans).toHaveBeenCalledWith('test-org-id', 10, false);
    });

    it('respects custom limit', async () => {
      mockAwsAccountService.getRecentScans.mockResolvedValue([]);

      await app.request('/aws/scans/recent?limit=25');
      expect(mockAwsAccountService.getRecentScans).toHaveBeenCalledWith('test-org-id', 25, false);
    });

    it('clamps limit to 100', async () => {
      mockAwsAccountService.getRecentScans.mockResolvedValue([]);

      await app.request('/aws/scans/recent?limit=200');
      expect(mockAwsAccountService.getRecentScans).toHaveBeenCalledWith('test-org-id', 100, false);
    });

    it('supports includeArchived flag', async () => {
      mockAwsAccountService.getRecentScans.mockResolvedValue([]);

      await app.request('/aws/scans/recent?includeArchived=true');
      expect(mockAwsAccountService.getRecentScans).toHaveBeenCalledWith('test-org-id', 10, true);
    });
  });

  describe('GET /aws/scans/:scanId', () => {
    it('returns scan details', async () => {
      const scan = createScan();
      mockAwsAccountService.getScan.mockResolvedValue(scan);

      const res = await app.request('/aws/scans/scan-1');
      expect(res.status).toBe(200);
    });
  });
});
