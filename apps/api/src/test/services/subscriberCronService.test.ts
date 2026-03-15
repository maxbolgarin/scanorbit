import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createChain } from '../helpers/mockDb.js';

let selectResult: unknown[] = [];

const { mockRedis, mockSubscriberService, mockSendImmediate } = vi.hoisted(() => ({
  mockRedis: {
    set: vi.fn().mockResolvedValue('OK'),
    get: vi.fn().mockResolvedValue(null),
    on: vi.fn(),
    status: 'ready',
  },
  mockSubscriberService: {
    isConfigured: vi.fn().mockReturnValue(true),
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
  config: {
    email: {
      resend: {
        apiKey: 'test-resend-key',
      },
    },
  },
}));

vi.mock('../../services/subscriberService.js', () => ({
  subscriberService: mockSubscriberService,
}));

vi.mock('../../services/dripSchedulerService.js', () => ({
  sendImmediate: mockSendImmediate,
}));

vi.mock('../../db/schema.js', () => ({
  orgs: { id: 'id', tier: 'tier', subscriptionStatus: 'subscription_status' },
  scans: { id: 'id', orgId: 'org_id', status: 'status', completedAt: 'completed_at' },
  users: { id: 'id', email: 'email', fullName: 'full_name' },
  userOrgMembers: { userId: 'user_id', orgId: 'org_id', role: 'role' },
  findings: { orgId: 'org_id', severity: 'severity', status: 'status', type: 'type' },
}));

vi.mock('../../types/index.js', () => ({
  ScanStatus: { COMPLETE: 'complete' },
}));

import { startSubscriberCron } from '../../services/subscriberCronService.js';

describe('subscriberCronService', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    selectResult = [];

    mockRedis.set.mockResolvedValue('OK');
    mockRedis.get.mockResolvedValue(null);
    mockSubscriberService.isConfigured.mockReturnValue(true);
    mockSubscriberService.onFirstScanComplete.mockResolvedValue(undefined);
    mockSubscriberService.onTrialActive.mockResolvedValue(undefined);
    mockSubscriberService.updateAttribsByEmail.mockResolvedValue(true);
    mockSendImmediate.mockResolvedValue(undefined);

    const { db } = await import('../../lib/db.js');
    vi.mocked(db.select).mockImplementation(() => createChain(selectResult) as any);
  });

  describe('startSubscriberCron', () => {
    it('does not start when Resend not configured', () => {
      mockSubscriberService.isConfigured.mockReturnValue(false);
      const spy = vi.spyOn(global, 'setInterval');

      startSubscriberCron();

      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it('starts interval and runs immediately when configured', () => {
      mockSubscriberService.isConfigured.mockReturnValue(true);
      const spy = vi.spyOn(global, 'setInterval').mockReturnValue(0 as any);

      startSubscriberCron();

      expect(spy).toHaveBeenCalledWith(expect.any(Function), 60_000);
      spy.mockRestore();
    });

    it('acquires distributed lock before processing', async () => {
      mockSubscriberService.isConfigured.mockReturnValue(true);
      vi.spyOn(global, 'setInterval').mockReturnValue(0 as any);

      startSubscriberCron();

      // Allow the immediate safeProcessListTransitions() call to run
      await vi.waitFor(() => {
        expect(mockRedis.set).toHaveBeenCalledWith(
          'subscriber:cron:lock', '1', 'EX', 55, 'NX',
        );
      });

      vi.restoreAllMocks();
    });

    it('skips processing when lock not acquired', async () => {
      mockRedis.set.mockResolvedValue(null); // Lock not acquired
      mockSubscriberService.isConfigured.mockReturnValue(true);
      vi.spyOn(global, 'setInterval').mockReturnValue(0 as any);

      startSubscriberCron();

      await vi.waitFor(() => {
        expect(mockRedis.set).toHaveBeenCalled();
      });

      // onFirstScanComplete should not be called because lock was not acquired
      expect(mockSubscriberService.onFirstScanComplete).not.toHaveBeenCalled();
      expect(mockSubscriberService.onTrialActive).not.toHaveBeenCalled();

      vi.restoreAllMocks();
    });

    it('processes first scan completions when lock acquired', async () => {
      const { db } = await import('../../lib/db.js');

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
          return createChain([{ email: 'admin@test.com', fullName: 'Admin User' }]) as any;
        }
        if (callCount === 4) {
          return createChain([{ severity: 'high', total: 2 }]) as any;
        }
        if (callCount === 5) {
          return createChain([{ total: 1 }]) as any; // 1 cost finding
        }
        return createChain([]) as any;
      });

      mockSubscriberService.isConfigured.mockReturnValue(true);
      vi.spyOn(global, 'setInterval').mockReturnValue(0 as any);

      startSubscriberCron();

      await vi.waitFor(() => {
        expect(mockSubscriberService.onFirstScanComplete).toHaveBeenCalledWith('admin@test.com');
      });

      expect(mockRedis.set).toHaveBeenCalledWith('subscriber:processed:first-scan:scan-1', '1', 'EX', 30 * 86_400);

      // Verify scan stats include critical_count and cost_count
      await vi.waitFor(() => {
        expect(mockSubscriberService.updateAttribsByEmail).toHaveBeenCalledWith(
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

      mockRedis.get.mockResolvedValue('1'); // Already processed

      mockSubscriberService.isConfigured.mockReturnValue(true);
      vi.spyOn(global, 'setInterval').mockReturnValue(0 as any);

      startSubscriberCron();

      await vi.waitFor(() => {
        expect(mockRedis.get).toHaveBeenCalled();
      });

      expect(mockSubscriberService.onFirstScanComplete).not.toHaveBeenCalled();

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

      mockSubscriberService.isConfigured.mockReturnValue(true);
      vi.spyOn(global, 'setInterval').mockReturnValue(0 as any);

      startSubscriberCron();

      await vi.waitFor(() => {
        expect(mockRedis.set).toHaveBeenCalled();
      });
      // Small delay to let async processing complete
      await new Promise(r => setTimeout(r, 20));

      expect(mockSubscriberService.onFirstScanComplete).not.toHaveBeenCalled();

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
          return createChain([{ email: 'trial@test.com', fullName: 'Trial User' }]) as any;
        }
        return createChain([]) as any;
      });

      mockSubscriberService.isConfigured.mockReturnValue(true);
      vi.spyOn(global, 'setInterval').mockReturnValue(0 as any);

      startSubscriberCron();

      await vi.waitFor(() => {
        expect(mockSubscriberService.onTrialActive).toHaveBeenCalledWith('trial@test.com');
      });

      expect(mockRedis.set).toHaveBeenCalledWith('subscriber:processed:trial-active:org-trial', '1', 'EX', 30 * 86_400);

      vi.restoreAllMocks();
    });

    it('calls cleanupExpiredTrialActive during cron run', async () => {
      mockSubscriberService.isConfigured.mockReturnValue(true);
      vi.spyOn(global, 'setInterval').mockReturnValue(0 as any);

      startSubscriberCron();

      await vi.waitFor(() => {
        expect(mockSubscriberService.cleanupExpiredTrialActive).toHaveBeenCalled();
      });

      vi.restoreAllMocks();
    });

    it('handles errors without crashing', async () => {
      const { db } = await import('../../lib/db.js');
      vi.mocked(db.select).mockImplementation(() => {
        throw new Error('DB connection error');
      });

      mockSubscriberService.isConfigured.mockReturnValue(true);
      vi.spyOn(global, 'setInterval').mockReturnValue(0 as any);

      // Should not throw
      startSubscriberCron();

      await vi.waitFor(() => {
        expect(mockRedis.set).toHaveBeenCalled();
      });

      vi.restoreAllMocks();
    });
  });
});
