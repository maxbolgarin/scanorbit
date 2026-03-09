import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createChain } from '../helpers/mockDb.js';

let selectResult: unknown[] = [];

vi.mock('../../lib/db.js', () => ({
  db: {
    select: vi.fn(() => createChain(selectResult)),
  },
  pool: {},
}));

import { dependencyService } from '../../services/dependencyService.js';

describe('dependencyService', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    selectResult = [];
    const { db } = await import('../../lib/db.js');
    vi.mocked(db.select).mockImplementation(() => createChain(selectResult) as any);
  });

  describe('getDependencies', () => {
    it('returns empty array when resource not found', async () => {
      selectResult = [];
      const result = await dependencyService.getDependencies('org-1', 'r-1');
      expect(result).toEqual([]);
    });

    it('returns empty array when no dependencies', async () => {
      let callCount = 0;
      const { db } = await import('../../lib/db.js');
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) return createChain([{ id: 'r-1' }]) as any; // resource found
        return createChain([]) as any; // no deps
      });

      const result = await dependencyService.getDependencies('org-1', 'r-1');
      expect(result).toEqual([]);
    });

    it('returns dependencies with resolved target resources', async () => {
      let callCount = 0;
      const { db } = await import('../../lib/db.js');
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) return createChain([{ id: 'r-1' }]) as any;
        if (callCount === 2) return createChain([{
          id: 'dep-1',
          targetResourceId: 'sg-123',
          targetService: 'ec2',
          relationshipType: 'security_group',
          createdAt: new Date(),
        }]) as any;
        return createChain([{
          id: 'r-2',
          resourceId: 'sg-123',
          name: 'my-sg',
          region: 'us-east-1',
          state: 'active',
        }]) as any;
      });

      const result = await dependencyService.getDependencies('org-1', 'r-1');
      expect(result).toHaveLength(1);
      expect(result[0].targetResource).toBeDefined();
      expect(result[0].targetResource?.name).toBe('my-sg');
    });
  });

  describe('getDependents', () => {
    it('returns empty array when resource not found', async () => {
      selectResult = [];
      const result = await dependencyService.getDependents('org-1', 'r-1');
      expect(result).toEqual([]);
    });

    it('returns empty array when no dependents', async () => {
      let callCount = 0;
      const { db } = await import('../../lib/db.js');
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) return createChain([{ id: 'r-1', resourceId: 'i-12345' }]) as any;
        return createChain([]) as any;
      });

      const result = await dependencyService.getDependents('org-1', 'r-1');
      expect(result).toEqual([]);
    });

    it('returns dependents with source resources', async () => {
      let callCount = 0;
      const { db } = await import('../../lib/db.js');
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) return createChain([{ id: 'r-1', resourceId: 'i-12345' }]) as any;
        if (callCount === 2) return createChain([{
          id: 'dep-1',
          sourceResourceId: 'r-2',
          relationshipType: 'attached_to',
          createdAt: new Date(),
        }]) as any;
        return createChain([{
          id: 'r-2',
          resourceId: 'vol-abc',
          name: 'my-volume',
          region: 'us-east-1',
          state: 'in-use',
          service: 'ebs',
        }]) as any;
      });

      const result = await dependencyService.getDependents('org-1', 'r-1');
      expect(result).toHaveLength(1);
      expect(result[0].sourceResource.service).toBe('ebs');
    });
  });

  describe('getAllDependencies', () => {
    it('returns all dependencies for org', async () => {
      selectResult = [
        { id: 'dep-1', sourceResourceId: 'r-1', targetResourceId: 'r-2' },
        { id: 'dep-2', sourceResourceId: 'r-3', targetResourceId: 'r-4' },
      ];
      const result = await dependencyService.getAllDependencies('org-1');
      expect(result).toHaveLength(2);
    });

    it('returns empty array when no dependencies', async () => {
      selectResult = [];
      const result = await dependencyService.getAllDependencies('org-1');
      expect(result).toEqual([]);
    });
  });

  describe('getDependencyStats', () => {
    it('returns aggregated stats', async () => {
      const { db } = await import('../../lib/db.js');
      let callCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) return createChain([{ relationshipType: 'security_group', count: 5 }]) as any;
        if (callCount === 2) return createChain([{ targetService: 'ec2', count: 3 }]) as any;
        return createChain([{ count: 8 }]) as any;
      });

      const stats = await dependencyService.getDependencyStats('org-1');
      expect(stats.totalCount).toBe(8);
      expect(stats.byType).toEqual({ security_group: 5 });
      expect(stats.byTargetService).toEqual({ ec2: 3 });
    });

    it('returns zero counts when no dependencies', async () => {
      const { db } = await import('../../lib/db.js');
      vi.mocked(db.select).mockImplementation(() => createChain([]) as any);

      const stats = await dependencyService.getDependencyStats('org-1');
      expect(stats.totalCount).toBe(0);
      expect(stats.byType).toEqual({});
      expect(stats.byTargetService).toEqual({});
    });
  });
});
