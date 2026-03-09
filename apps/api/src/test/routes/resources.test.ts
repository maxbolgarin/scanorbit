import { describe, it, expect, vi, beforeEach } from 'vitest';
import { jsonBody } from '../setup.js';
import { Hono } from 'hono';
import type { Variables } from '../../types/index.js';
import { createResource } from '../helpers/factories.js';
import { createChain } from '../helpers/mockDb.js';

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

vi.mock('../../lib/db.js', () => ({
  db: {
    select: vi.fn(() => createChain([])),
    insert: vi.fn(() => createChain([])),
    update: vi.fn(() => createChain([])),
  },
  pool: {},
}));

const { mockResourceService, mockDependencyService, mockFindingService, mockGetOrgTier } = vi.hoisted(() => ({
  mockResourceService: {
    getResources: vi.fn(),
    getResource: vi.fn(),
    updateResourceTags: vi.fn(),
    getResourceStats: vi.fn(),
    getDistinctRegions: vi.fn(),
    getDistinctServices: vi.fn(),
  },
  mockDependencyService: {
    getAllDependencies: vi.fn(),
    getDependencyStats: vi.fn(),
    getDependencies: vi.fn(),
    getDependents: vi.fn(),
  },
  mockFindingService: {
    getResourceHealth: vi.fn(),
    getResourceFindingTimeline: vi.fn(),
  },
  mockGetOrgTier: vi.fn().mockResolvedValue('pro'),
}));

vi.mock('../../services/resourceService.js', () => ({
  resourceService: mockResourceService,
}));

vi.mock('../../services/dependencyService.js', () => ({
  dependencyService: mockDependencyService,
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

import resourcesRoute from '../../routes/resources.js';
import { errorHandler } from '../../middlewares/errorHandler.js';

describe('Resources Routes', () => {
  let app: Hono<{ Variables: Variables }>;

  beforeEach(() => {
    app = new Hono<{ Variables: Variables }>();
    app.route('/resources', resourcesRoute);
    app.onError(errorHandler);
    vi.clearAllMocks();
    mockGetOrgTier.mockResolvedValue('pro');
  });

  describe('GET /resources', () => {
    it('returns paginated resources for pro tier', async () => {
      const resources = [createResource()];
      mockResourceService.getResources.mockResolvedValue({
        data: resources,
        pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
      });

      const res = await app.request('/resources');
      expect(res.status).toBe(200);
    });

    it('returns 403 for free tier', async () => {
      mockGetOrgTier.mockResolvedValue('free');

      const res = await app.request('/resources');
      expect(res.status).toBe(403);
    });

    it('passes filters to service', async () => {
      mockResourceService.getResources.mockResolvedValue({
        data: [],
        pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
      });

      await app.request('/resources?service=ec2&region=eu-central-1');

      expect(mockResourceService.getResources).toHaveBeenCalledWith(
        'test-org-id',
        expect.objectContaining({ service: 'ec2', region: 'eu-central-1' })
      );
    });
  });

  describe('GET /resources/stats', () => {
    it('returns resource stats', async () => {
      mockResourceService.getResourceStats.mockResolvedValue({ total: 50 });

      const res = await app.request('/resources/stats');
      expect(res.status).toBe(200);
    });
  });

  describe('GET /resources/health', () => {
    it('returns resource health', async () => {
      mockFindingService.getResourceHealth.mockResolvedValue([]);

      const res = await app.request('/resources/health');
      expect(res.status).toBe(200);
    });
  });

  describe('GET /resources/regions', () => {
    it('returns distinct regions', async () => {
      mockResourceService.getDistinctRegions.mockResolvedValue(['eu-central-1', 'us-east-1']);

      const res = await app.request('/resources/regions');
      expect(res.status).toBe(200);
      const body = await jsonBody(res);
      expect(body.data).toEqual(['eu-central-1', 'us-east-1']);
    });
  });

  describe('GET /resources/:id', () => {
    it('returns resource details', async () => {
      const resource = createResource();
      mockResourceService.getResource.mockResolvedValue(resource);

      const res = await app.request('/resources/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
      expect(res.status).toBe(200);
    });

    it('returns 400 for invalid UUID', async () => {
      const res = await app.request('/resources/not-a-uuid');
      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /resources/:id', () => {
    it('updates resource tags', async () => {
      const resource = createResource({ tags: { env: 'prod' } });
      mockResourceService.updateResourceTags.mockResolvedValue(resource);

      const res = await app.request('/resources/res-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: { env: 'prod' } }),
      });
      expect(res.status).toBe(200);
    });

    it('rejects invalid tag keys', async () => {
      const res = await app.request('/resources/res-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: { 'invalid key!': 'value' } }),
      });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /resources/dependencies/all', () => {
    it('returns 403 for free tier', async () => {
      mockGetOrgTier.mockResolvedValue('free');

      const res = await app.request('/resources/dependencies/all');
      expect(res.status).toBe(403);
    });

    it('returns dependencies for pro tier', async () => {
      mockDependencyService.getAllDependencies.mockResolvedValue([]);

      const res = await app.request('/resources/dependencies/all');
      expect(res.status).toBe(200);
    });
  });
});
