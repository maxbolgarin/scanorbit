import { describe, it, expect, vi, beforeEach } from 'vitest';
import { jsonBody } from '../setup.js';
import { Hono } from 'hono';
import type { Variables } from '../../types/index.js';
import { createOrg } from '../helpers/factories.js';
import { createChain } from '../helpers/mockDb.js';

let dbSelectResult: unknown[] = [];

vi.mock('../../middlewares/auth.js', () => ({
  requireAuth: vi.fn(async (c: any, next: any) => {
    c.set('userId', 'test-user-id');
    c.set('orgId', 'test-org-id');
    await next();
  }),
}));

vi.mock('../../middlewares/processingRestriction.js', () => ({
  requireNoProcessingRestriction: vi.fn(async (_c: any, next: any) => { await next(); }),
}));

const { mockOrgService, mockOrgSettingsService } = vi.hoisted(() => ({
  mockOrgService: {
    createOrg: vi.fn(),
    getUserOrgs: vi.fn(),
    getOrg: vi.fn(),
    updateOrg: vi.fn(),
    getOrgMembers: vi.fn(),
    getSubscriptionStatus: vi.fn(),
    upgradeSubscription: vi.fn(),
  },
  mockOrgSettingsService: {
    getSettings: vi.fn(),
    updateSettings: vi.fn(),
  },
}));

vi.mock('../../services/orgService.js', () => ({
  orgService: mockOrgService,
  getOrgTier: vi.fn().mockResolvedValue('pro'),
  verifyOrgAdmin: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/orgSettingsService.js', () => ({
  orgSettingsService: mockOrgSettingsService,
}));

vi.mock('../../lib/authTokens.js', () => ({
  setAuthTokens: vi.fn().mockResolvedValue({ accessToken: 'mock-token' }),
}));

vi.mock('../../services/invitationService.js', () => ({
  invitationService: {
    createInvitation: vi.fn(),
    listInvitations: vi.fn(),
    cancelInvitation: vi.fn(),
    resendInvitation: vi.fn(),
    removeMember: vi.fn(),
    changeMemberRole: vi.fn(),
    getSeatInfo: vi.fn(),
  },
}));

vi.mock('../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../lib/metrics.js', () => ({
  errorsTotal: { inc: vi.fn() },
}));

vi.mock('../../lib/db.js', () => ({
  db: {
    select: vi.fn(() => createChain(dbSelectResult)),
    insert: vi.fn(() => createChain([])),
    update: vi.fn(() => createChain([])),
    delete: vi.fn(() => createChain([])),
  },
  pool: {},
}));

import orgsRoute from '../../routes/orgs.js';
import { errorHandler } from '../../middlewares/errorHandler.js';

describe('Orgs Routes', () => {
  let app: Hono<{ Variables: Variables }>;

  beforeEach(async () => {
    app = new Hono<{ Variables: Variables }>();
    app.route('/orgs', orgsRoute);
    app.onError(errorHandler);
    vi.clearAllMocks();
    dbSelectResult = [];
    const { db } = await import('../../lib/db.js');
    vi.mocked(db.select).mockImplementation(() => createChain(dbSelectResult) as any);
  });

  describe('GET /orgs', () => {
    it('returns user organizations', async () => {
      const orgs = [createOrg(), createOrg()];
      mockOrgService.getUserOrgs.mockResolvedValue(orgs);

      const res = await app.request('/orgs');
      expect(res.status).toBe(200);
      const body = await jsonBody(res);
      expect(body.data).toHaveLength(2);
    });
  });

  describe('POST /orgs', () => {
    it('creates organization', async () => {
      const org = createOrg({ name: 'New Org' });
      mockOrgService.createOrg.mockResolvedValue({ org });

      const res = await app.request('/orgs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgName: 'New Org' }),
      });
      expect(res.status).toBe(201);
      const body = await jsonBody(res);
      expect(body.data).toBeDefined();
      expect(body.accessToken).toBe('mock-token');
    });

    it('rejects short org name', async () => {
      const res = await app.request('/orgs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgName: 'A' }),
      });
      expect(res.status).toBe(400);
    });

    it('rejects too long org name', async () => {
      const res = await app.request('/orgs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgName: 'A'.repeat(33) }),
      });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /orgs/:id', () => {
    it('returns org details', async () => {
      const org = createOrg();
      mockOrgService.getOrg.mockResolvedValue(org);

      const res = await app.request('/orgs/org-1');
      expect(res.status).toBe(200);
    });
  });

  describe('PATCH /orgs/:id', () => {
    it('updates org name', async () => {
      const org = createOrg({ name: 'Updated' });
      mockOrgService.updateOrg.mockResolvedValue(org);

      const res = await app.request('/orgs/org-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Updated' }),
      });
      expect(res.status).toBe(200);
    });
  });

  describe('GET /orgs/:id/members', () => {
    it('returns org members', async () => {
      mockOrgService.getOrgMembers.mockResolvedValue([]);

      const res = await app.request('/orgs/org-1/members');
      expect(res.status).toBe(200);
    });
  });

  describe('GET /orgs/:id/settings', () => {
    it('returns org settings', async () => {
      mockOrgSettingsService.getSettings.mockResolvedValue({
        requiredTags: ['env'],
        hiddenFindingTypes: [],
        hideTrivial: false,
      });

      const res = await app.request('/orgs/org-1/settings');
      expect(res.status).toBe(200);
      const body = await jsonBody(res);
      expect(body.data.requiredTags).toEqual(['env']);
    });
  });

  describe('PATCH /orgs/:id/settings', () => {
    it('updates org settings', async () => {
      mockOrgSettingsService.updateSettings.mockResolvedValue({
        requiredTags: ['env', 'team'],
        hiddenFindingTypes: [],
        hideTrivial: true,
      });

      const res = await app.request('/orgs/org-1/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requiredTags: ['env', 'team'], hideTrivial: true }),
      });
      expect(res.status).toBe(200);
    });
  });

  describe('GET /orgs/:id/subscription', () => {
    it('returns subscription status', async () => {
      mockOrgService.getSubscriptionStatus.mockResolvedValue({
        tier: 'pro',
        limits: {},
      });

      const res = await app.request('/orgs/org-1/subscription');
      expect(res.status).toBe(200);
    });
  });

  describe('GET /orgs/:id/audit-logs', () => {
    beforeEach(async () => {
      const orgServiceModule = await import('../../services/orgService.js');
      vi.mocked(orgServiceModule.getOrgTier).mockResolvedValue('team' as any);
    });

    it('returns 403 for non-Team tier', async () => {
      const orgServiceModule = await import('../../services/orgService.js');
      vi.mocked(orgServiceModule.getOrgTier).mockResolvedValue('free' as any);

      const res = await app.request('/orgs/org-1/audit-logs');
      expect(res.status).toBe(403);
    });

    it('returns empty list when no logs exist', async () => {
      dbSelectResult = [];

      const res = await app.request('/orgs/org-1/audit-logs');
      expect(res.status).toBe(200);
      const body = await jsonBody(res);
      expect(body.data).toEqual([]);
      expect(body.pagination.total).toBe(0);
      expect(body.pagination.totalPages).toBe(0);
    });

    it('returns logs with user info', async () => {
      dbSelectResult = [{
        id: 'log-1',
        timestamp: new Date('2024-01-15T10:00:00Z'),
        userId: 'user-1',
        action: 'login',
        method: 'POST',
        path: '/auth/login',
        statusCode: 200,
        ipAddress: '127.0.0.1',
        durationMs: 42,
        userEmail: 'alice@example.com',
        userFullName: 'Alice Smith',
        totalCount: 1,
      }];

      const res = await app.request('/orgs/org-1/audit-logs');
      expect(res.status).toBe(200);
      const body = await jsonBody(res);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].action).toBe('login');
      expect(body.data[0].userEmail).toBe('alice@example.com');
      expect(body.data[0].userFullName).toBe('Alice Smith');
      expect(body.pagination.total).toBe(1);
      expect(body.pagination.totalPages).toBe(1);
    });

    it('accepts action filter', async () => {
      dbSelectResult = [];
      const res = await app.request('/orgs/org-1/audit-logs?action=login');
      expect(res.status).toBe(200);
    });

    it('accepts valid userId filter', async () => {
      dbSelectResult = [];
      const res = await app.request('/orgs/org-1/audit-logs?userId=550e8400-e29b-41d4-a716-446655440000');
      expect(res.status).toBe(200);
    });

    it('rejects invalid userId (non-UUID)', async () => {
      const res = await app.request('/orgs/org-1/audit-logs?userId=not-a-uuid');
      expect(res.status).toBe(400);
    });

    it('accepts valid date range', async () => {
      dbSelectResult = [];
      const res = await app.request('/orgs/org-1/audit-logs?startDate=2024-01-01T00:00:00Z&endDate=2024-01-31T23:59:59Z');
      expect(res.status).toBe(200);
    });

    it('rejects invalid date format (date-only, no time)', async () => {
      const res = await app.request('/orgs/org-1/audit-logs?startDate=2024-01-01');
      expect(res.status).toBe(400);
    });

    it('returns correct pagination for multiple pages', async () => {
      dbSelectResult = Array.from({ length: 25 }, (_, i) => ({
        id: `log-${i}`,
        timestamp: new Date(),
        userId: 'user-1',
        action: 'read',
        method: 'GET',
        path: '/api/something',
        statusCode: 200,
        ipAddress: null,
        durationMs: 10,
        userEmail: null,
        userFullName: null,
        totalCount: 75,
      }));

      const res = await app.request('/orgs/org-1/audit-logs?page=1&limit=25');
      expect(res.status).toBe(200);
      const body = await jsonBody(res);
      expect(body.pagination.total).toBe(75);
      expect(body.pagination.totalPages).toBe(3);
      expect(body.data).toHaveLength(25);
    });
  });
});
