import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createChain } from '../helpers/mockDb.js';

let selectResult: unknown[] = [];
let deleteResult: unknown[] = [];
const mockTransaction = vi.fn();

vi.mock('../../lib/db.js', () => ({
  db: {
    select: vi.fn(() => createChain(selectResult)),
    delete: vi.fn(() => createChain(deleteResult)),
    update: vi.fn(() => createChain([])),
    transaction: (...args: unknown[]) => mockTransaction(...args),
  },
  pool: {},
}));

vi.mock('../../lib/config.js', () => ({
  config: {
    retentionResourcesDays: 90,
    retentionFindingsResolvedDays: 180,
    retentionScansDays: 365,
    retentionAuditLogsDays: 730,
  },
}));

vi.mock('../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../services/listmonkService.js', () => ({
  listmonkService: {
    deleteSubscriber: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../services/stripeService.js', () => ({
  stripeService: {
    isConfigured: vi.fn().mockReturnValue(false),
    cancelSubscriptionById: vi.fn(),
    deleteCustomer: vi.fn(),
  },
}));

vi.mock('../../lib/redis.js', () => ({
  refreshTokenStore: {
    revokeAllForUser: vi.fn().mockResolvedValue(undefined),
  },
}));

import { runRetentionCleanup, getRetentionStats } from '../../services/retentionService.js';

describe('retentionService', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    selectResult = [];
    deleteResult = [];
    const { db } = await import('../../lib/db.js');
    vi.mocked(db.select).mockImplementation(() => createChain(selectResult) as any);
    vi.mocked(db.delete).mockImplementation(() => createChain(deleteResult) as any);
    vi.mocked(db.update).mockImplementation(() => createChain([]) as any);
    mockTransaction.mockImplementation(async (fn: any) => {
      const tx = {
        select: vi.fn(() => createChain([{ id: 'user-1' }])),
        delete: vi.fn(() => createChain([])),
        update: vi.fn(() => createChain([])),
      };
      return fn(tx);
    });
  });

  describe('runRetentionCleanup', () => {
    it('runs all cleanup tasks', async () => {
      // delete returns items for each cleanup type
      const { db } = await import('../../lib/db.js');
      vi.mocked(db.delete).mockImplementation(() =>
        createChain([{ id: 'item-1' }]) as any
      );

      // processPendingDeletions: select returns no pending requests
      vi.mocked(db.select).mockImplementation(() => createChain([]) as any);

      const result = await runRetentionCleanup();
      expect(result.resourcesDeleted).toBe(1);
      expect(result.findingsDeleted).toBe(1);
      expect(result.scansDeleted).toBe(1);
      expect(result.auditLogsArchived).toBe(1);
      expect(result.errors).toHaveLength(0);
    });

    it('captures errors without failing entire job', async () => {
      const { db } = await import('../../lib/db.js');
      vi.mocked(db.delete).mockImplementation(() => {
        throw new Error('DB error');
      });
      vi.mocked(db.select).mockImplementation(() => {
        throw new Error('DB error');
      });

      const result = await runRetentionCleanup();
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('processes pending deletion requests', async () => {
      const { db } = await import('../../lib/db.js');

      // First 4 calls are for delete (stale resources, findings, scans, audit logs)
      vi.mocked(db.delete).mockImplementation(() => createChain([]) as any);

      // The 5th call (processPendingDeletions) does a select
      let selectCalls = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCalls++;
        // pending requests query returns a request
        if (selectCalls === 1) {
          return createChain([{
            id: 'req-1',
            userId: 'user-1',
            status: 'pending',
            scheduledDeletionAt: new Date(Date.now() - 86400000),
          }]) as any;
        }
        // user email lookup
        if (selectCalls === 2) {
          return createChain([{ email: 'user@test.com' }]) as any;
        }
        // org memberships
        if (selectCalls === 3) {
          return createChain([]) as any;
        }
        return createChain([]) as any;
      });

      const result = await runRetentionCleanup();
      expect(result.deletionRequestsProcessed).toBe(1);
    });
  });

  describe('getRetentionStats', () => {
    it('returns retention statistics', async () => {
      selectResult = [{ count: 5 }];

      const stats = await getRetentionStats();
      expect(stats).toHaveProperty('pendingDeletions');
      expect(stats).toHaveProperty('staleResources');
      expect(stats).toHaveProperty('oldFindings');
      expect(stats).toHaveProperty('oldAuditLogs');
    });
  });
});
