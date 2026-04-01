import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createChain } from '../helpers/mockDb.js';

vi.mock('../../lib/db.js', () => ({
  db: {
    select: vi.fn(() => createChain([])),
    insert: vi.fn(() => createChain([])),
    update: vi.fn(() => createChain([])),
  },
  pool: {},
}));

vi.mock('../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Mock schema with simple field name references
vi.mock('../../db/schema.js', () => ({
  findings: {
    id: 'id',
    orgId: 'org_id',
    severity: 'severity',
    status: 'status',
    summary: 'summary',
    type: 'type',
    resourceId: 'resource_id',
    createdAt: 'created_at',
    resolvedAt: 'resolved_at',
  },
  resources: {
    id: 'id',
    orgId: 'org_id',
    costEstimateMonthly: 'cost_estimate_monthly',
  },
  scans: {
    id: 'id',
    orgId: 'org_id',
    completedAt: 'completed_at',
  },
}));

import { digestService } from '../../services/digestService.js';

describe('digestService', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { db } = await import('../../lib/db.js');
    vi.mocked(db.select).mockImplementation(() => createChain([]) as any);
  });

  describe('aggregateDigest', () => {
    it('returns correct finding counts by severity', async () => {
      const { db } = await import('../../lib/db.js');

      let callCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // severity counts query
          return createChain([
            { severity: 'critical', count: '3' },
            { severity: 'high', count: '5' },
            { severity: 'medium', count: '2' },
          ]) as any;
        }
        if (callCount === 2) {
          // resolved count query
          return createChain([{ count: '4' }]) as any;
        }
        if (callCount === 3) {
          // top items query
          return createChain([]) as any;
        }
        if (callCount === 4) {
          // cost savings query
          return createChain([{ total: '0' }]) as any;
        }
        if (callCount === 5) {
          // scans run query
          return createChain([{ count: '7' }]) as any;
        }
        return createChain([]) as any;
      });

      const result = await digestService.aggregateDigest('org-1', 7);

      expect(result.findingsBySeverity.critical).toBe(3);
      expect(result.findingsBySeverity.high).toBe(5);
      expect(result.findingsBySeverity.medium).toBe(2);
      expect(result.findingsBySeverity.low).toBe(0);
      expect(result.findingsBySeverity.trivial).toBe(0);
      expect(result.newFindings).toBe(10);
      expect(result.resolvedFindings).toBe(4);
      expect(result.scansRun).toBe(7);
    });

    it('returns top actionable items sorted by severity', async () => {
      const { db } = await import('../../lib/db.js');

      const topItems = [
        { id: 'f-1', type: 'public_access', severity: 'critical', summary: 'Critical issue', resourceId: 'r-1' },
        { id: 'f-2', type: 'unencrypted_resource', severity: 'high', summary: 'High issue', resourceId: 'r-2' },
        { id: 'f-3', type: 'missing_tag', severity: 'medium', summary: 'Medium issue', resourceId: null },
      ];

      let callCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // severity counts
          return createChain([{ severity: 'critical', count: '1' }, { severity: 'high', count: '1' }, { severity: 'medium', count: '1' }]) as any;
        }
        if (callCount === 2) {
          // resolved count
          return createChain([{ count: '0' }]) as any;
        }
        if (callCount === 3) {
          // top items — already ordered by severity (DB handles ORDER BY)
          return createChain(topItems) as any;
        }
        if (callCount === 4) {
          // cost savings
          return createChain([{ total: '0' }]) as any;
        }
        if (callCount === 5) {
          // scans
          return createChain([{ count: '1' }]) as any;
        }
        return createChain([]) as any;
      });

      const result = await digestService.aggregateDigest('org-1', 7);

      expect(result.topActionableItems).toHaveLength(3);
      expect(result.topActionableItems[0].id).toBe('f-1');
      expect(result.topActionableItems[0].severity).toBe('critical');
      expect(result.topActionableItems[1].severity).toBe('high');
      expect(result.topActionableItems[2].resourceId).toBeNull();
    });

    it('calculates cost savings from cost findings', async () => {
      const { db } = await import('../../lib/db.js');

      let callCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // severity counts
          return createChain([{ severity: 'high', count: '2' }]) as any;
        }
        if (callCount === 2) {
          // resolved
          return createChain([{ count: '1' }]) as any;
        }
        if (callCount === 3) {
          // top items
          return createChain([]) as any;
        }
        if (callCount === 4) {
          // cost savings — sum of costEstimateMonthly
          return createChain([{ total: '247.50' }]) as any;
        }
        if (callCount === 5) {
          // scans
          return createChain([{ count: '3' }]) as any;
        }
        return createChain([]) as any;
      });

      const result = await digestService.aggregateDigest('org-1', 7);

      expect(result.estimatedCostSavings).toBeCloseTo(247.5);
    });

    it('handles empty results gracefully', async () => {
      const { db } = await import('../../lib/db.js');

      let callCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 2) {
          // resolved count (returns empty array — no result)
          return createChain([]) as any;
        }
        if (callCount === 4) {
          // cost savings — null total
          return createChain([{ total: null }]) as any;
        }
        if (callCount === 5) {
          // scans — empty
          return createChain([]) as any;
        }
        return createChain([]) as any;
      });

      const result = await digestService.aggregateDigest('org-1', 1);

      expect(result.findingsBySeverity.critical).toBe(0);
      expect(result.findingsBySeverity.high).toBe(0);
      expect(result.findingsBySeverity.medium).toBe(0);
      expect(result.findingsBySeverity.low).toBe(0);
      expect(result.findingsBySeverity.trivial).toBe(0);
      expect(result.newFindings).toBe(0);
      expect(result.resolvedFindings).toBe(0);
      expect(result.estimatedCostSavings).toBe(0);
      expect(result.scansRun).toBe(0);
      expect(result.topActionableItems).toHaveLength(0);
    });
  });
});
