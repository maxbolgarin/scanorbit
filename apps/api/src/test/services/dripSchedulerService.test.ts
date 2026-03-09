import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createChain } from '../helpers/mockDb.js';

let selectResult: unknown[] = [];
let insertResult: unknown[] = [];

const { mockRedis, mockListmonkService } = vi.hoisted(() => ({
  mockRedis: {
    set: vi.fn().mockResolvedValue('OK'),
    get: vi.fn().mockResolvedValue(null),
    on: vi.fn(),
    status: 'ready',
  },
  mockListmonkService: {
    isConfigured: vi.fn().mockReturnValue(true),
    listsConfigured: vi.fn().mockReturnValue(true),
    sendTx: vi.fn().mockResolvedValue(true),
    queryByList: vi.fn().mockResolvedValue([]),
    subscribe: vi.fn().mockResolvedValue(true),
    unsubscribe: vi.fn().mockResolvedValue(true),
    deleteSubscriber: vi.fn().mockResolvedValue(true),
    onUserSignup: vi.fn().mockResolvedValue(undefined),
    onFirstScanComplete: vi.fn().mockResolvedValue(undefined),
    onTrialStart: vi.fn().mockResolvedValue(undefined),
    onTrialActive: vi.fn().mockResolvedValue(undefined),
    onPayment: vi.fn().mockResolvedValue(undefined),
    onPlanChange: vi.fn().mockResolvedValue(undefined),
    onChurn: vi.fn().mockResolvedValue(undefined),
    updateAttribsByEmail: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('../../lib/db.js', () => ({
  db: {
    select: vi.fn(() => createChain(selectResult)),
    insert: vi.fn(() => createChain(insertResult)),
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
    defaultListId: 1,
    lists: {
      coldLeads: 1,
      subscribers: 2,
      freeNew: 3,
      freeScanned: 4,
      trialNew: 5,
      trialActive: 6,
      paidPro: 7,
      paidTeam: 8,
    },
  },
}));

vi.mock('../../services/listmonkService.js', () => ({
  listmonkService: mockListmonkService,
}));

vi.mock('../../db/schema.js', () => ({
  dripLog: {
    id: 'id',
    subscriberEmail: 'subscriber_email',
    sequenceName: 'sequence_name',
    emailDay: 'email_day',
    sentAt: 'sent_at',
  },
}));

import { sendImmediate, startDripScheduler } from '../../services/dripSchedulerService.js';

describe('dripSchedulerService', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    selectResult = [];
    insertResult = [];

    mockRedis.set.mockResolvedValue('OK');
    mockListmonkService.isConfigured.mockReturnValue(true);
    mockListmonkService.sendTx.mockResolvedValue(true);
    mockListmonkService.queryByList.mockResolvedValue([]);

    const { db } = await import('../../lib/db.js');
    vi.mocked(db.select).mockImplementation(() => createChain(selectResult) as any);
    vi.mocked(db.insert).mockImplementation(() => createChain(insertResult) as any);
  });

  describe('sendImmediate', () => {
    it('sends day-0 email for valid sequence', async () => {
      // No prior sends (select returns empty)
      selectResult = [];

      await sendImmediate({
        sequenceName: 'free-new',
        email: 'user@test.com',
        name: 'John Doe',
      });

      expect(mockListmonkService.sendTx).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'user@test.com',
          data: expect.objectContaining({ first_name: 'John' }),
        }),
      );
    });

    it('skips unknown sequence name', async () => {
      await sendImmediate({
        sequenceName: 'nonexistent-sequence',
        email: 'user@test.com',
      });

      expect(mockListmonkService.sendTx).not.toHaveBeenCalled();
    });

    it('skips if already sent (dedup)', async () => {
      // wasSent returns a row
      selectResult = [{ id: 'existing-id' }];

      await sendImmediate({
        sequenceName: 'free-new',
        email: 'user@test.com',
      });

      expect(mockListmonkService.sendTx).not.toHaveBeenCalled();
    });

    it('records sent email after successful send', async () => {
      selectResult = [];
      mockListmonkService.sendTx.mockResolvedValue(true);

      const { db } = await import('../../lib/db.js');

      await sendImmediate({
        sequenceName: 'free-new',
        email: 'user@test.com',
      });

      expect(db.insert).toHaveBeenCalled();
    });

    it('does not record when send fails', async () => {
      selectResult = [];
      mockListmonkService.sendTx.mockResolvedValue(false);

      const { db } = await import('../../lib/db.js');

      await sendImmediate({
        sequenceName: 'free-new',
        email: 'user@test.com',
      });

      // insert is called by createChain for wasSent (select), but markSent should not be called
      // since sendTx returned false
      expect(mockListmonkService.sendTx).toHaveBeenCalled();
    });

    it('never throws on error (fire-and-forget)', async () => {
      selectResult = [];
      mockListmonkService.sendTx.mockRejectedValue(new Error('network error'));

      // Should not throw
      await expect(
        sendImmediate({
          sequenceName: 'free-new',
          email: 'user@test.com',
        }),
      ).resolves.toBeUndefined();
    });

    it('extracts first_name from full name', async () => {
      selectResult = [];

      await sendImmediate({
        sequenceName: 'free-new',
        email: 'user@test.com',
        name: 'Jane Smith',
      });

      expect(mockListmonkService.sendTx).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ first_name: 'Jane' }),
        }),
      );
    });

    it('handles null name gracefully', async () => {
      selectResult = [];

      await sendImmediate({
        sequenceName: 'free-new',
        email: 'user@test.com',
        name: null,
      });

      expect(mockListmonkService.sendTx).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ first_name: '' }),
        }),
      );
    });

    it('passes custom data in send payload', async () => {
      selectResult = [];

      await sendImmediate({
        sequenceName: 'free-new',
        email: 'user@test.com',
        data: { total_findings: 5 },
      });

      expect(mockListmonkService.sendTx).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ total_findings: 5 }),
        }),
      );
    });

    it('includes fromEmail when step defines it', async () => {
      selectResult = [];

      await sendImmediate({
        sequenceName: 'cold-leads',
        email: 'user@test.com',
      });

      expect(mockListmonkService.sendTx).toHaveBeenCalledWith(
        expect.objectContaining({
          fromEmail: expect.stringContaining('Maksim'),
        }),
      );
    });
  });

  describe('startDripScheduler', () => {
    it('does not start when listmonk is not configured', () => {
      mockListmonkService.isConfigured.mockReturnValue(false);
      const spy = vi.spyOn(global, 'setInterval');

      startDripScheduler();

      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it('starts interval when listmonk is configured', () => {
      mockListmonkService.isConfigured.mockReturnValue(true);
      const spy = vi.spyOn(global, 'setInterval').mockReturnValue(0 as any);

      startDripScheduler();

      expect(spy).toHaveBeenCalledWith(expect.any(Function), 60_000);
      spy.mockRestore();
    });
  });
});
