import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createChain } from '../helpers/mockDb.js';

let selectResult: unknown[] = [];
let updateResult: unknown[] = [];

vi.mock('../../lib/db.js', () => ({
  db: {
    select: vi.fn(() => createChain(selectResult)),
    update: vi.fn(() => createChain(updateResult)),
    selectDistinct: vi.fn(() => createChain([])),
  },
  pool: {},
}));

vi.mock('../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { resourceService } from '../../services/resourceService.js';

describe('resourceService', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    selectResult = [];
    updateResult = [];
    const { db } = await import('../../lib/db.js');
    vi.mocked(db.select).mockImplementation(() => createChain(selectResult) as any);
    vi.mocked(db.update).mockImplementation(() => createChain(updateResult) as any);
    vi.mocked(db.selectDistinct).mockImplementation(() => createChain([]) as any);
  });

  describe('getResources', () => {
    it('returns paginated resources', async () => {
      let callCount = 0;
      const { db } = await import('../../lib/db.js');
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) return createChain([{ count: 5 }]) as any;
        return createChain([{ id: 'r-1' }, { id: 'r-2' }]) as any;
      });

      const result = await resourceService.getResources('org-1', {});
      expect(result.data).toHaveLength(2);
      expect(result.pagination.total).toBe(5);
      expect(result.pagination.page).toBe(1);
    });

    it('caps limit at 100', async () => {
      let callCount = 0;
      const { db } = await import('../../lib/db.js');
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) return createChain([{ count: 0 }]) as any;
        return createChain([]) as any;
      });

      const result = await resourceService.getResources('org-1', { limit: 500 });
      expect(result.pagination.limit).toBe(100);
    });
  });

  describe('getResource', () => {
    it('finds by UUID', async () => {
      selectResult = [{ id: 'c0a80001-0000-0000-0000-000000000001', resourceId: 'arn:...' }];
      const result = await resourceService.getResource('org-1', 'c0a80001-0000-0000-0000-000000000001');
      expect(result.resourceId).toBe('arn:...');
    });

    it('falls back to resource ID lookup', async () => {
      let callCount = 0;
      const { db } = await import('../../lib/db.js');
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) return createChain([]) as any; // UUID lookup fails
        return createChain([{ id: 'r-1', resourceId: 'i-12345' }]) as any; // resourceId lookup
      });

      const result = await resourceService.getResource('org-1', 'c0a80001-0000-0000-0000-000000000001');
      expect(result.resourceId).toBe('i-12345');
    });

    it('looks up by resource ID for non-UUID strings', async () => {
      selectResult = [{ id: 'r-1', resourceId: 'i-12345' }];
      const result = await resourceService.getResource('org-1', 'i-12345');
      expect(result.resourceId).toBe('i-12345');
    });

    it('throws 404 when not found', async () => {
      selectResult = [];
      await expect(resourceService.getResource('org-1', 'missing'))
        .rejects.toThrow('Resource not found');
    });
  });

  describe('updateResourceTags', () => {
    it('updates tags', async () => {
      updateResult = [{ id: 'r-1', tags: { env: 'prod' } }];
      const result = await resourceService.updateResourceTags('org-1', 'r-1', { tags: { env: 'prod' } });
      expect(result.tags).toEqual({ env: 'prod' });
    });

    it('throws 404 when not found', async () => {
      updateResult = [];
      await expect(resourceService.updateResourceTags('org-1', 'missing', { tags: {} }))
        .rejects.toThrow('Resource not found');
    });
  });

  describe('getResourceStats', () => {
    it('returns aggregated stats', async () => {
      const { db } = await import('../../lib/db.js');
      vi.mocked(db.select).mockImplementation(() =>
        createChain([{ count: 10 }]) as any
      );

      const stats = await resourceService.getResourceStats('org-1');
      expect(stats).toHaveProperty('totalCount');
      expect(stats).toHaveProperty('byService');
      expect(stats).toHaveProperty('byRegion');
      expect(stats).toHaveProperty('byState');
      expect(stats).toHaveProperty('costByService');
    });
  });

  describe('getDistinctRegions', () => {
    it('returns regions filtering nulls', async () => {
      const { db } = await import('../../lib/db.js');
      vi.mocked(db.selectDistinct).mockImplementation(() =>
        createChain([{ region: 'eu-central-1' }, { region: null }, { region: 'us-east-1' }]) as any
      );

      const regions = await resourceService.getDistinctRegions('org-1');
      expect(regions).toEqual(['eu-central-1', 'us-east-1']);
    });
  });

  describe('getDistinctServices', () => {
    it('returns services', async () => {
      const { db } = await import('../../lib/db.js');
      vi.mocked(db.selectDistinct).mockImplementation(() =>
        createChain([{ service: 'ec2' }, { service: 'rds' }]) as any
      );

      const services = await resourceService.getDistinctServices('org-1');
      expect(services).toEqual(['ec2', 'rds']);
    });
  });
});
