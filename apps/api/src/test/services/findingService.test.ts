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

import { findingService } from '../../services/findingService.js';

describe('findingService', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    selectResult = [];
    updateResult = [];
    const { db } = await import('../../lib/db.js');
    vi.mocked(db.select).mockImplementation(() => createChain(selectResult) as any);
    vi.mocked(db.update).mockImplementation(() => createChain(updateResult) as any);
  });

  describe('getFindings', () => {
    it('returns paginated findings', async () => {
      // getFindings calls select twice: count + data
      let callCount = 0;
      const { db } = await import('../../lib/db.js');
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) return createChain([{ count: 2 }]) as any; // count query
        return createChain([{ id: 'f-1' }, { id: 'f-2' }]) as any; // data query
      });

      const result = await findingService.getFindings('org-1', {});
      expect(result.data).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(50);
    });

    it('respects page and limit', async () => {
      let callCount = 0;
      const { db } = await import('../../lib/db.js');
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) return createChain([{ count: 100 }]) as any;
        return createChain([]) as any;
      });

      const result = await findingService.getFindings('org-1', { page: 3, limit: 25 });
      expect(result.pagination.page).toBe(3);
      expect(result.pagination.limit).toBe(25);
      expect(result.pagination.totalPages).toBe(4);
    });

    it('caps limit at 100', async () => {
      let callCount = 0;
      const { db } = await import('../../lib/db.js');
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) return createChain([{ count: 0 }]) as any;
        return createChain([]) as any;
      });

      const result = await findingService.getFindings('org-1', { limit: 200 });
      expect(result.pagination.limit).toBe(100);
    });
  });

  describe('getFinding', () => {
    it('returns finding with resource and certificate', async () => {
      let callCount = 0;
      const { db } = await import('../../lib/db.js');
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) return createChain([{ id: 'f-1', resourceId: 'r-1', certificateId: 'c-1' }]) as any;
        if (callCount === 2) return createChain([{ id: 'r-1', arn: 'arn:...' }]) as any;
        return createChain([{ id: 'c-1' }]) as any;
      });

      const result = await findingService.getFinding('org-1', 'f-1');
      expect(result.id).toBe('f-1');
      expect(result.resource).toBeDefined();
      expect(result.certificate).toBeDefined();
    });

    it('throws 404 when not found', async () => {
      selectResult = [];
      await expect(findingService.getFinding('org-1', 'missing'))
        .rejects.toThrow('Finding not found');
    });
  });

  describe('updateFinding', () => {
    it('updates finding status to resolved', async () => {
      updateResult = [{ id: 'f-1', status: 'resolved' }];
      const result = await findingService.updateFinding('org-1', 'f-1', { status: 'resolved' });
      expect(result.status).toBe('resolved');
    });

    it('throws 400 for invalid status', async () => {
      await expect(findingService.updateFinding('org-1', 'f-1', { status: 'invalid' as any }))
        .rejects.toThrow('Invalid status');
    });

    it('throws 400 when snoozing without snoozedUntil', async () => {
      await expect(findingService.updateFinding('org-1', 'f-1', { status: 'snoozed' }))
        .rejects.toThrow('snoozedUntil is required');
    });

    it('throws 404 when finding not found', async () => {
      updateResult = [];
      await expect(findingService.updateFinding('org-1', 'missing', { status: 'resolved' }))
        .rejects.toThrow('Finding not found');
    });
  });

  describe('bulkUpdateStatus', () => {
    it('updates multiple findings', async () => {
      updateResult = [{ id: 'f-1' }, { id: 'f-2' }];
      const count = await findingService.bulkUpdateStatus('org-1', ['f-1', 'f-2'], 'resolved');
      expect(count).toBe(2);
    });

    it('throws 400 for invalid status', async () => {
      await expect(findingService.bulkUpdateStatus('org-1', ['f-1'], 'bad' as any))
        .rejects.toThrow('Invalid status');
    });
  });

  describe('getFindingHistory', () => {
    it('returns detection history', async () => {
      let callCount = 0;
      const { db } = await import('../../lib/db.js');
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) return createChain([{ id: 'f-1' }]) as any; // verify finding
        return createChain([{ scanId: 's-1', status: 'detected' }]) as any; // history
      });

      const history = await findingService.getFindingHistory('org-1', 'f-1');
      expect(history).toHaveLength(1);
    });

    it('throws 404 when finding not found', async () => {
      selectResult = [];
      await expect(findingService.getFindingHistory('org-1', 'missing'))
        .rejects.toThrow('Finding not found');
    });
  });

  describe('getFindingStats', () => {
    it('returns aggregated stats', async () => {
      // getFindingStats uses Promise.all with 6 parallel queries
      // All resolve to selectResult since the mock is the same for all
      selectResult = [];
      const { db } = await import('../../lib/db.js');
      vi.mocked(db.select).mockImplementation(() => createChain([{ count: 0 }]) as any);
      vi.mocked(db.selectDistinct).mockImplementation(() => createChain([]) as any);

      const stats = await findingService.getFindingStats('org-1');
      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('open');
      expect(stats).toHaveProperty('byStatus');
      expect(stats).toHaveProperty('bySeverity');
      expect(stats).toHaveProperty('byType');
    });
  });

  describe('getResourceFindingTimeline', () => {
    it('returns empty array when no findings', async () => {
      selectResult = [];
      const result = await findingService.getResourceFindingTimeline('org-1', 'r-1');
      expect(result).toEqual([]);
    });
  });
});
