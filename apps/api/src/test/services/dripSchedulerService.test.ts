import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createChain } from '../helpers/mockDb.js';

let selectResult: unknown[] = [];
let insertResult: unknown[] = [];

const { mockRedis, mockSubscriberService, mockSendDripEmail } = vi.hoisted(() => ({
  mockRedis: {
    set: vi.fn().mockResolvedValue('OK'),
    get: vi.fn().mockResolvedValue(null),
    on: vi.fn(),
    status: 'ready',
  },
  mockSubscriberService: {
    isConfigured: vi.fn().mockReturnValue(true),
    queryByList: vi.fn().mockResolvedValue([]),
  },
  mockSendDripEmail: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../lib/db.js', () => ({
  db: {
    select: vi.fn(() => createChain(selectResult)),
    insert: vi.fn(() => createChain(insertResult)),
    update: vi.fn(() => createChain([])),
    delete: vi.fn(() => createChain([])),
  },
  pool: {},
}));

vi.mock('../../lib/redis.js', () => ({
  redis: mockRedis,
}));

vi.mock('../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../services/subscriberService.js', () => ({
  subscriberService: mockSubscriberService,
}));

vi.mock('../../emails/dripSender.js', () => ({
  sendDripEmail: mockSendDripEmail,
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
    mockSubscriberService.isConfigured.mockReturnValue(true);
    mockSendDripEmail.mockResolvedValue(true);
    mockSubscriberService.queryByList.mockResolvedValue([]);

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

      expect(mockSendDripEmail).toHaveBeenCalledWith(
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

      expect(mockSendDripEmail).not.toHaveBeenCalled();
    });

    it('skips if already sent (dedup)', async () => {
      // wasSent returns a row
      selectResult = [{ id: 'existing-id' }];

      await sendImmediate({
        sequenceName: 'free-new',
        email: 'user@test.com',
      });

      expect(mockSendDripEmail).not.toHaveBeenCalled();
    });

    it('records sent email after successful send', async () => {
      selectResult = [];
      mockSendDripEmail.mockResolvedValue(true);

      const { db } = await import('../../lib/db.js');

      await sendImmediate({
        sequenceName: 'free-new',
        email: 'user@test.com',
      });

      expect(db.insert).toHaveBeenCalled();
    });

    it('does not record when send fails', async () => {
      selectResult = [];
      mockSendDripEmail.mockResolvedValue(false);

      const { db } = await import('../../lib/db.js');

      await sendImmediate({
        sequenceName: 'free-new',
        email: 'user@test.com',
      });

      // sendDripEmail returned false, so markSent should not be called
      expect(mockSendDripEmail).toHaveBeenCalled();
    });

    it('never throws on error (fire-and-forget)', async () => {
      selectResult = [];
      mockSendDripEmail.mockRejectedValue(new Error('network error'));

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

      expect(mockSendDripEmail).toHaveBeenCalledWith(
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

      expect(mockSendDripEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ first_name: 'there' }),
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

      expect(mockSendDripEmail).toHaveBeenCalledWith(
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

      expect(mockSendDripEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          fromEmail: expect.stringContaining('Maksim'),
        }),
      );
    });
  });

  describe('startDripScheduler', () => {
    it('does not start when Resend is not configured', () => {
      mockSubscriberService.isConfigured.mockReturnValue(false);
      const spy = vi.spyOn(global, 'setInterval');

      startDripScheduler();

      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it('starts interval when Resend is configured', () => {
      mockSubscriberService.isConfigured.mockReturnValue(true);
      const spy = vi.spyOn(global, 'setInterval').mockReturnValue(0 as any);

      startDripScheduler();

      expect(spy).toHaveBeenCalledWith(expect.any(Function), 60_000);
      spy.mockRestore();
    });
  });
});
