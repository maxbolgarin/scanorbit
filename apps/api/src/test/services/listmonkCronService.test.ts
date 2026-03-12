import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createChain } from '../helpers/mockDb.js';

let selectResult: unknown[] = [];

const { mockRedis, mockListmonkService, mockSendImmediate } = vi.hoisted(() => ({
  mockRedis: {
    set: vi.fn().mockResolvedValue('OK'),
    sismember: vi.fn().mockResolvedValue(0),
    sadd: vi.fn().mockResolvedValue(1),
    on: vi.fn(),
    status: 'ready',
  },
  mockListmonkService: {
    isConfigured: vi.fn().mockReturnValue(true),
    listsConfigured: vi.fn().mockReturnValue(true),
    onFirstScanComplete: vi.fn().mockResolvedValue(undefined),
    onTrialActive: vi.fn().mockResolvedValue(undefined),
    updateAttribsByEmail: vi.fn().mockResolvedValue(true),
    cleanupExpiredTrialActive: vi.fn().mockResolvedValue(undefined),
  },
  mockSendImmediate: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../lib/db.js', () => ({
  db: {
    select: vi.fn(() => createChain(selectResult)),
    insert: vi.fn(() => createChain([])),
    update: vi.fn(() => createChain([])),
  },
  pool: {},
}));

vi.mock('../../lib/redis.js', () => ({
  redis: mockRedis,
}));

vi.mock('../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../lib/config.js', () => ({
  listmonkConfig: {
    apiUrl: 'http://localhost:9000',
    apiUser: 'admin',
    apiPassword: 'testpass',
    lists: {
      coldLeads: 1, subscribers: 2, freeNew: 3, freeScanned: 4,
      trialNew: 5, trialActive: 6, paidPro: 7, paidTeam: 8,
    },
  },
}));

vi.mock('../../services/listmonkService.js', () => ({
  listmonkService: mockListmonkService,
}));

vi.mock('../../services/dripSchedulerService.js', () => ({
  sendImmediate: mockSendImmediate,
}));

vi.mock('../../db/schema.js', () => ({
  orgs: { id: 'id', tier: 'tier', subscriptionStatus: 'subscription_status' },
  scans: { id: 'id', orgId: 'org_id', status: 'status', completedAt: 'completed_at' },
  users: { id: 'id', email: 'email' },
  userOrgMembers: { userId: 'user_id', orgId: 'org_id', role: 'role' },
  findings: { orgId: 'org_id', severity: 'severity', status: 'status', type: 'type' },
}));

vi.mock('../../types/index.js', () => ({
  ScanStatus: { COMPLETE: 'complete' },
}));

import { startListmonkCron } from '../../services/listmonkCronService.js';

describe('listmonkCronService', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    selectResult = [];

    mockRedis.set.mockResolvedValue('OK');
    mockRedis.sismember.mockResolvedValue(0);
    mockRedis.sadd.mockResolvedValue(1);
    mockListmonkService.listsConfigured.mockReturnValue(true);
    mockListmonkService.onFirstScanComplete.mockResolvedValue(undefined);
    mockListmonkService.onTrialActive.mockResolvedValue(undefined);
    mockListmonkService.updateAttribsByEmail.mockResolvedValue(true);
    mockSendImmediate.mockResolvedValue(undefined);

    const { db } = await import('../../lib/db.js');
    vi.mocked(db.select).mockImplementation(() => createChain(selectResult) as any);
  });

  describe('startListmonkCron', () => {
    it('does not start when lists not configured', () => {
      mockListmonkService.listsConfigured.mockReturnValue(false);
      const spy = vi.spyOn(global, 'setInterval');

      startListmonkCron();

      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it('starts interval and runs immediately when configured', () => {
      mockListmonkService.listsConfigured.mockReturnValue(true);
      const spy = vi.spyOn(global, 'setInterval').mockReturnValue(0 as any);

      startListmonkCron();

      expect(spy).toHaveBeenCalledWith(expect.any(Function), 60_000);
      spy.mockRestore();
    });

    it('acquires distributed lock before processing', async () => {
      mockListmonkService.listsConfigured.mockReturnValue(true);
      vi.spyOn(global, 'setInterval').mockReturnValue(0 as any);

      startListmonkCron();

      // Allow the immediate safeProcessListTransitions() call to run
      await vi.waitFor(() => {
        expect(mockRedis.set).toHaveBeenCalledWith(
          'listmonk:cron:lock', '1', 'EX', 55, 'NX',
        );
      });

      vi.restoreAllMocks();
    });

    it('skips processing when lock not acquired', async () => {
      mockRedis.set.mockResolvedValue(null); // Lock not acquired
      mockListmonkService.listsConfigured.mockReturnValue(true);
      vi.spyOn(global, 'setInterval').mockReturnValue(0 as any);

      startListmonkCron();

      await vi.waitFor(() => {
        expect(mockRedis.set).toHaveBeenCalled();
      });

      // onFirstScanComplete should not be called because lock was not acquired
      expect(mockListmonkService.onFirstScanComplete).not.toHaveBeenCalled();
      expect(mockListmonkService.onTrialActive).not.toHaveBeenCalled();

      vi.restoreAllMocks();
    });

    it('processes first scan completions when lock acquired', async () => {
      const { db } = await import('../../lib/db.js');

      // First call: processFirstScanCompletions query - returns a recent scan
      // Second call: verify first scan count query - returns count 1
      // Third call: getAdminEmail query - returns admin
      // Fourth call: findings severity query
      // Fifth call: findings cost count query
      // Sixth call: processTrialActiveTransitions query - returns empty
      let callCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return createChain([{ orgId: 'org-1', scanId: 'scan-1' }]) as any;
        }
        if (callCount === 2) {
          return createChain([{ total: 1 }]) as any;
        }
        if (callCount === 3) {
          return createChain([{ email: 'admin@test.com' }]) as any;
        }
        if (callCount === 4) {
          return createChain([{ severity: 'high', total: 2 }]) as any;
        }
        if (callCount === 5) {
          return createChain([{ total: 1 }]) as any; // 1 cost finding
        }
        return createChain([]) as any;
      });

      mockListmonkService.listsConfigured.mockReturnValue(true);
      vi.spyOn(global, 'setInterval').mockReturnValue(0 as any);

      startListmonkCron();

      await vi.waitFor(() => {
        expect(mockListmonkService.onFirstScanComplete).toHaveBeenCalledWith('admin@test.com');
      });

      expect(mockRedis.sadd).toHaveBeenCalledWith('listmonk:processed:first-scan', 'scan-1');

      // Verify scan stats include critical_count and cost_count
      await vi.waitFor(() => {
        expect(mockListmonkService.updateAttribsByEmail).toHaveBeenCalledWith(
          'admin@test.com',
          expect.objectContaining({
            critical_count: 0,
            high_count: 2,
            cost_count: 1,
          }),
        );
      });

      vi.restoreAllMocks();
    });

    it('skips already processed scans via Redis dedup', async () => {
      const { db } = await import('../../lib/db.js');

      let callCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return createChain([{ orgId: 'org-1', scanId: 'scan-1' }]) as any;
        }
        // processTrialActiveTransitions returns empty
        return createChain([]) as any;
      });

      mockRedis.sismember.mockResolvedValue(1); // Already processed

      mockListmonkService.listsConfigured.mockReturnValue(true);
      vi.spyOn(global, 'setInterval').mockReturnValue(0 as any);

      startListmonkCron();

      await vi.waitFor(() => {
        expect(mockRedis.sismember).toHaveBeenCalled();
      });

      expect(mockListmonkService.onFirstScanComplete).not.toHaveBeenCalled();

      vi.restoreAllMocks();
    });

    it('skips orgs with more than one completed scan', async () => {
      const { db } = await import('../../lib/db.js');

      let callCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return createChain([{ orgId: 'org-1', scanId: 'scan-2' }]) as any;
        }
        if (callCount === 2) {
          return createChain([{ total: 3 }]) as any; // Not the first scan
        }
        return createChain([]) as any;
      });

      mockListmonkService.listsConfigured.mockReturnValue(true);
      vi.spyOn(global, 'setInterval').mockReturnValue(0 as any);

      startListmonkCron();

      await vi.waitFor(() => {
        expect(mockRedis.set).toHaveBeenCalled();
      });
      // Small delay to let async processing complete
      await new Promise(r => setTimeout(r, 20));

      expect(mockListmonkService.onFirstScanComplete).not.toHaveBeenCalled();

      vi.restoreAllMocks();
    });

    it('processes trial-active transitions', async () => {
      const { db } = await import('../../lib/db.js');

      let callCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // processFirstScanCompletions - no results
          return createChain([]) as any;
        }
        if (callCount === 2) {
          // processTrialActiveTransitions - trialing org with 2+ scans
          return createChain([{ orgId: 'org-trial', scanCount: 3 }]) as any;
        }
        if (callCount === 3) {
          // getAdminEmail
          return createChain([{ email: 'trial@test.com' }]) as any;
        }
        return createChain([]) as any;
      });

      mockListmonkService.listsConfigured.mockReturnValue(true);
      vi.spyOn(global, 'setInterval').mockReturnValue(0 as any);

      startListmonkCron();

      await vi.waitFor(() => {
        expect(mockListmonkService.onTrialActive).toHaveBeenCalledWith('trial@test.com');
      });

      expect(mockRedis.sadd).toHaveBeenCalledWith('listmonk:processed:trial-active', 'org-trial');

      vi.restoreAllMocks();
    });

    it('calls cleanupExpiredTrialActive during cron run', async () => {
      mockListmonkService.listsConfigured.mockReturnValue(true);
      vi.spyOn(global, 'setInterval').mockReturnValue(0 as any);

      startListmonkCron();

      await vi.waitFor(() => {
        expect(mockListmonkService.cleanupExpiredTrialActive).toHaveBeenCalled();
      });

      vi.restoreAllMocks();
    });

    it('handles errors without crashing', async () => {
      const { db } = await import('../../lib/db.js');
      vi.mocked(db.select).mockImplementation(() => {
        throw new Error('DB connection error');
      });

      mockListmonkService.listsConfigured.mockReturnValue(true);
      vi.spyOn(global, 'setInterval').mockReturnValue(0 as any);

      // Should not throw
      startListmonkCron();

      await vi.waitFor(() => {
        expect(mockRedis.set).toHaveBeenCalled();
      });

      vi.restoreAllMocks();
    });
  });
});
