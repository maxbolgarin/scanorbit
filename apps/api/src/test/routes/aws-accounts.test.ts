import { describe, it, expect, vi, beforeEach } from 'vitest';
import { jsonBody } from '../setup.js';
import { Hono } from 'hono';
import type { Variables } from '../../types/index.js';
import { createAwsAccount } from '../helpers/factories.js';

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

const { mockAwsAccountService } = vi.hoisted(() => ({
  mockAwsAccountService: {
    getAccounts: vi.fn(),
    createAccount: vi.fn(),
    getAccount: vi.fn(),
    deleteAccount: vi.fn(),
    updateEnabledScanners: vi.fn(),
    testConnection: vi.fn(),
    enqueueScan: vi.fn(),
    getScanHistory: vi.fn(),
    enqueueAllAnalyses: vi.fn(),
    enqueueAnalysis: vi.fn(),
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

import awsAccountsRoute from '../../routes/aws-accounts.js';
import { errorHandler } from '../../middlewares/errorHandler.js';

describe('AWS Accounts Routes', () => {
  let app: Hono<{ Variables: Variables }>;

  beforeEach(() => {
    app = new Hono<{ Variables: Variables }>();
    app.route('/aws/accounts', awsAccountsRoute);
    app.onError(errorHandler);
    vi.clearAllMocks();
  });

  describe('GET /aws/accounts', () => {
    it('returns accounts list', async () => {
      const accounts = [createAwsAccount()];
      mockAwsAccountService.getAccounts.mockResolvedValue(accounts);

      const res = await app.request('/aws/accounts');
      expect(res.status).toBe(200);
      const body = await jsonBody(res);
      expect(body.data).toHaveLength(1);
    });
  });

  describe('POST /aws/accounts', () => {
    it('creates AWS account', async () => {
      const account = createAwsAccount();
      mockAwsAccountService.createAccount.mockResolvedValue(account);

      const res = await app.request('/aws/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Production',
          awsAccountId: '123456789012',
          roleArn: 'arn:aws:iam::123456789012:role/ScanOrbit',
        }),
      });
      expect(res.status).toBe(201);
    });

    it('rejects invalid AWS account ID', async () => {
      const res = await app.request('/aws/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Prod',
          awsAccountId: '12345', // Not 12 digits
          roleArn: 'arn:aws:iam::123456789012:role/ScanOrbit',
        }),
      });
      expect(res.status).toBe(400);
    });

    it('rejects invalid role ARN', async () => {
      const res = await app.request('/aws/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Prod',
          awsAccountId: '123456789012',
          roleArn: 'not-a-valid-arn',
        }),
      });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /aws/accounts/:id', () => {
    it('returns account details', async () => {
      const account = createAwsAccount();
      mockAwsAccountService.getAccount.mockResolvedValue(account);

      const res = await app.request('/aws/accounts/acc-1');
      expect(res.status).toBe(200);
    });
  });

  describe('DELETE /aws/accounts/:id', () => {
    it('deletes account', async () => {
      mockAwsAccountService.deleteAccount.mockResolvedValue(undefined);

      const res = await app.request('/aws/accounts/acc-1', { method: 'DELETE' });
      expect(res.status).toBe(200);
    });
  });

  describe('PATCH /aws/accounts/:id/scanners', () => {
    it('updates enabled scanners', async () => {
      const account = createAwsAccount({ enabledScanners: ['ec2', 'rds'] });
      mockAwsAccountService.updateEnabledScanners.mockResolvedValue(account);

      const res = await app.request('/aws/accounts/acc-1/scanners', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabledScanners: ['ec2', 'rds'] }),
      });
      expect(res.status).toBe(200);
    });

    it('rejects empty scanners list', async () => {
      const res = await app.request('/aws/accounts/acc-1/scanners', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabledScanners: [] }),
      });
      expect(res.status).toBe(400);
    });

    it('rejects invalid scanner type', async () => {
      const res = await app.request('/aws/accounts/acc-1/scanners', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabledScanners: ['invalid_scanner'] }),
      });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /aws/accounts/:id/test', () => {
    it('tests connection', async () => {
      mockAwsAccountService.testConnection.mockResolvedValue({ success: true });

      const res = await app.request('/aws/accounts/acc-1/test', { method: 'POST' });
      expect(res.status).toBe(200);
    });
  });

  describe('POST /aws/accounts/:id/scan', () => {
    it('enqueues scan', async () => {
      mockAwsAccountService.enqueueScan.mockResolvedValue({ scanId: 'scan-1' });

      const res = await app.request('/aws/accounts/acc-1/scan', { method: 'POST' });
      expect(res.status).toBe(202);
    });
  });
});
