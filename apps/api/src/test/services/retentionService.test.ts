import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createChain } from '../helpers/mockDb.js';

let selectResult: unknown[] = [];
let deleteResult: unknown[] = [];
const mockTransaction = vi.fn();

let executeRowCount = 0;

vi.mock('../../lib/db.js', () => ({
  db: {
    select: vi.fn(() => createChain(selectResult)),
    delete: vi.fn(() => createChain(deleteResult)),
    update: vi.fn(() => createChain([])),
    execute: vi.fn(() => Promise.resolve({ rowCount: executeRowCount })),
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

vi.mock('../../services/subscriberService.js', () => ({
  subscriberService: {
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

import { runRetentionCleanup, getRetentionStats, TIER_RETENTION } from '../../services/retentionService.js';

describe('retentionService', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    selectResult = [];
    deleteResult = [];
    executeRowCount = 0;
    const { db } = await import('../../lib/db.js');
    vi.mocked(db.select).mockImplementation(() => createChain(selectResult) as any);
    vi.mocked(db.delete).mockImplementation(() => createChain(deleteResult) as any);
    vi.mocked(db.update).mockImplementation(() => createChain([]) as any);
    vi.mocked(db.execute).mockImplementation(() => Promise.resolve({ rowCount: executeRowCount }) as any);
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
      const { db } = await import('../../lib/db.js');

      // Resources, findings, scans use db.execute (tier-based SQL)
      executeRowCount = 1;
      vi.mocked(db.execute).mockImplementation(() =>
        Promise.resolve({ rowCount: 1 }) as any
      );

      // Audit logs still use db.delete
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
      vi.mocked(db.execute).mockImplementation(() => {
        throw new Error('DB error');
      });
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

      // Resources, findings, scans use db.execute (tier-based SQL)
      vi.mocked(db.execute).mockImplementation(() =>
        Promise.resolve({ rowCount: 0 }) as any
      );

      // Audit logs use db.delete
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

    it('skips deletion requests with null userId', async () => {
      const { db } = await import('../../lib/db.js');

      vi.mocked(db.execute).mockImplementation(() =>
        Promise.resolve({ rowCount: 0 }) as any
      );
      vi.mocked(db.delete).mockImplementation(() => createChain([]) as any);

      vi.mocked(db.select).mockImplementation(() => {
        return createChain([{
          id: 'req-orphan',
          userId: null,
          status: 'pending',
          scheduledDeletionAt: new Date(Date.now() - 86400000),
        }]) as any;
      });

      const result = await runRetentionCleanup();
      expect(result.deletionRequestsProcessed).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('marks deletion as failed on processing error', async () => {
      const { db } = await import('../../lib/db.js');

      vi.mocked(db.execute).mockImplementation(() =>
        Promise.resolve({ rowCount: 0 }) as any
      );
      vi.mocked(db.delete).mockImplementation(() => createChain([]) as any);

      let selectCalls = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCalls++;
        if (selectCalls === 1) {
          return createChain([{
            id: 'req-fail',
            userId: 'user-fail',
            status: 'pending',
            scheduledDeletionAt: new Date(Date.now() - 86400000),
          }]) as any;
        }
        // user email lookup - user not found triggers null path
        if (selectCalls === 2) {
          return createChain([]) as any;
        }
        // org memberships
        if (selectCalls === 3) {
          return createChain([]) as any;
        }
        return createChain([]) as any;
      });

      // Transaction throws to simulate error
      mockTransaction.mockRejectedValueOnce(new Error('Transaction failed'));

      const result = await runRetentionCleanup();
      expect(result.deletionRequestsProcessed).toBe(0);

      // Verify the failure was recorded via db.update
      expect(vi.mocked(db.update)).toHaveBeenCalled();
    });

    it('processes deletion with Stripe cleanup for orphaned orgs', async () => {
      const { db } = await import('../../lib/db.js');
      const { stripeService } = await import('../../services/stripeService.js');
      const { subscriberService } = await import('../../services/subscriberService.js');
      const { refreshTokenStore } = await import('../../lib/redis.js');

      vi.mocked(stripeService.isConfigured).mockReturnValue(true);
      vi.mocked(stripeService.cancelSubscriptionById).mockResolvedValue(undefined as any);
      vi.mocked(stripeService.deleteCustomer).mockResolvedValue(undefined as any);

      vi.mocked(db.execute).mockImplementation(() =>
        Promise.resolve({ rowCount: 0 }) as any
      );
      vi.mocked(db.delete).mockImplementation(() => createChain([]) as any);

      let selectCalls = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCalls++;
        if (selectCalls === 1) {
          // pending requests
          return createChain([{
            id: 'req-stripe',
            userId: 'user-stripe',
            status: 'pending',
            scheduledDeletionAt: new Date(Date.now() - 86400000),
          }]) as any;
        }
        if (selectCalls === 2) {
          // user email
          return createChain([{ email: 'stripe@test.com' }]) as any;
        }
        if (selectCalls === 3) {
          // org memberships with Stripe data
          return createChain([{
            orgId: 'org-1',
            stripeSubscriptionId: 'sub_123',
            stripeCustomerId: 'cus_456',
          }]) as any;
        }
        if (selectCalls === 4) {
          // member count for orphan check
          return createChain([{ count: 1 }]) as any;
        }
        return createChain([]) as any;
      });

      const result = await runRetentionCleanup();
      expect(result.deletionRequestsProcessed).toBe(1);

      // Verify external service cleanup
      expect(subscriberService.deleteSubscriber).toHaveBeenCalledWith('stripe@test.com');
      expect(refreshTokenStore.revokeAllForUser).toHaveBeenCalledWith('user-stripe');
      expect(stripeService.cancelSubscriptionById).toHaveBeenCalledWith('sub_123');
      expect(stripeService.deleteCustomer).toHaveBeenCalledWith('cus_456');
    });

    it('processes deletion with transaction that anonymizes data', async () => {
      const { db } = await import('../../lib/db.js');

      vi.mocked(db.execute).mockImplementation(() =>
        Promise.resolve({ rowCount: 0 }) as any
      );
      vi.mocked(db.delete).mockImplementation(() => createChain([]) as any);

      let selectCalls = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCalls++;
        if (selectCalls === 1) {
          return createChain([{
            id: 'req-anon',
            userId: 'user-anon',
            status: 'pending',
            scheduledDeletionAt: new Date(Date.now() - 86400000),
          }]) as any;
        }
        if (selectCalls === 2) {
          return createChain([{ email: 'anon@test.com' }]) as any;
        }
        return createChain([]) as any;
      });

      // Track transaction operations
      const txOps = {
        select: vi.fn(() => createChain([{ id: 'user-anon' }])),
        delete: vi.fn(() => createChain([])),
        update: vi.fn(() => createChain([])),
      };
      mockTransaction.mockImplementation(async (fn: any) => fn(txOps));

      const result = await runRetentionCleanup();
      expect(result.deletionRequestsProcessed).toBe(1);

      // Verify transaction performed all required operations
      // 1. Lock user row (select with FOR UPDATE)
      expect(txOps.select).toHaveBeenCalled();
      // 2. Remove org memberships (delete)
      expect(txOps.delete).toHaveBeenCalled();
      // 3. Anonymize audit logs + consent logs + deletion request (update)
      expect(txOps.update).toHaveBeenCalled();
    });
  });

  describe('TIER_RETENTION', () => {
    it('has correct free tier retention periods', () => {
      expect(TIER_RETENTION.free).toEqual({
        resourcesDays: 7,
        findingsResolvedDays: 14,
        scansDays: 30,
      });
    });

    it('has correct pro tier retention periods', () => {
      expect(TIER_RETENTION.pro).toEqual({
        resourcesDays: 90,
        findingsResolvedDays: 180,
        scansDays: 365,
      });
    });

    it('has correct team tier retention periods', () => {
      expect(TIER_RETENTION.team).toEqual({
        resourcesDays: 180,
        findingsResolvedDays: 365,
        scansDays: 730,
      });
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
