import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { Variables } from '../../types/index.js';
import { createOrg } from '../helpers/factories.js';

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
}));

vi.mock('../../services/orgSettingsService.js', () => ({
  orgSettingsService: mockOrgSettingsService,
}));

vi.mock('../../lib/authTokens.js', () => ({
  setAuthTokens: vi.fn().mockResolvedValue({ accessToken: 'mock-token' }),
}));

vi.mock('../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../lib/metrics.js', () => ({
  errorsTotal: { inc: vi.fn() },
}));

import orgsRoute from '../../routes/orgs.js';
import { errorHandler } from '../../middlewares/errorHandler.js';

describe('Orgs Routes', () => {
  let app: Hono<{ Variables: Variables }>;

  beforeEach(() => {
    app = new Hono<{ Variables: Variables }>();
    app.route('/orgs', orgsRoute);
    app.onError(errorHandler);
    vi.clearAllMocks();
  });

  describe('GET /orgs', () => {
    it('returns user organizations', async () => {
      const orgs = [createOrg(), createOrg()];
      mockOrgService.getUserOrgs.mockResolvedValue(orgs);

      const res = await app.request('/orgs');
      expect(res.status).toBe(200);
      const body = await res.json();
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
      const body = await res.json();
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
      const body = await res.json();
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
});
