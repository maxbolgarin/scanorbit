import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createChain } from '../helpers/mockDb.js';

let selectResult: unknown[] = [];
let insertResult: unknown[] = [];
let updateResult: unknown[] = [];
let deleteResult: unknown[] = [];

vi.mock('../../lib/db.js', () => ({
  db: {
    select: vi.fn(() => createChain(selectResult)),
    insert: vi.fn(() => createChain(insertResult)),
    update: vi.fn(() => createChain(updateResult)),
    delete: vi.fn(() => createChain(deleteResult)),
  },
  pool: {},
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

vi.mock('../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../services/dripSchedulerService.js', () => ({
  clearDripLog: vi.fn().mockResolvedValue(undefined),
  sendImmediate: vi.fn().mockResolvedValue(undefined),
  startDripScheduler: vi.fn(),
  buildUnsubscribeUrl: vi.fn().mockReturnValue('http://test/unsubscribe'),
}));

vi.mock('../../db/schema.js', () => ({
  emailSubscribers: {
    email: 'email',
    name: 'name',
    list: 'list',
    status: 'status',
    attributes: 'attributes',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
}));

import { subscriberService } from '../../services/subscriberService.js';

describe('subscriberService', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    selectResult = [];
    insertResult = [];
    updateResult = [];
    deleteResult = [];

    const { db } = await import('../../lib/db.js');
    vi.mocked(db.select).mockImplementation(() => createChain(selectResult) as any);
    vi.mocked(db.insert).mockImplementation(() => createChain(insertResult) as any);
    vi.mocked(db.update).mockImplementation(() => createChain(updateResult) as any);
    vi.mocked(db.delete).mockImplementation(() => createChain(deleteResult) as any);
  });

  describe('isConfigured', () => {
    it('returns true when Resend API key is set', () => {
      expect(subscriberService.isConfigured()).toBe(true);
    });
  });

  describe('subscribe', () => {
    it('subscribes to default subscribers list', async () => {
      const { db } = await import('../../lib/db.js');

      const result = await subscriberService.subscribe('user@test.com', 'User');
      expect(result).toBe(true);
      expect(db.insert).toHaveBeenCalled();
    });

    it('subscribes to custom list names', async () => {
      const { db } = await import('../../lib/db.js');

      const result = await subscriberService.subscribe('user@test.com', 'User', ['free-new', 'subscribers']);
      expect(result).toBe(true);
      // Should insert for each list
      expect(db.insert).toHaveBeenCalledTimes(2);
    });

    it('returns false on DB error', async () => {
      const { db } = await import('../../lib/db.js');
      vi.mocked(db.insert).mockImplementation(() => {
        throw new Error('DB error');
      });

      const result = await subscriberService.subscribe('user@test.com');
      expect(result).toBe(false);
    });
  });

  describe('unsubscribe', () => {
    it('sets status to unsubscribed', async () => {
      updateResult = [];
      const { db } = await import('../../lib/db.js');
      vi.mocked(db.update).mockImplementation(() => createChain([], { rowCount: 1 }) as any);

      const result = await subscriberService.unsubscribe('user@test.com');
      expect(result).toBe(true);
      expect(db.update).toHaveBeenCalled();
    });

    it('returns false when subscriber not found', async () => {
      const { db } = await import('../../lib/db.js');
      vi.mocked(db.update).mockImplementation(() => createChain([], { rowCount: 0 }) as any);

      const result = await subscriberService.unsubscribe('unknown@test.com');
      expect(result).toBe(false);
    });

    it('returns false on DB error', async () => {
      const { db } = await import('../../lib/db.js');
      vi.mocked(db.update).mockImplementation(() => {
        throw new Error('DB error');
      });

      const result = await subscriberService.unsubscribe('user@test.com');
      expect(result).toBe(false);
    });
  });

  describe('deleteSubscriber', () => {
    it('deletes subscriber from all lists', async () => {
      const { db } = await import('../../lib/db.js');
      vi.mocked(db.delete).mockImplementation(() => createChain([], { rowCount: 1 }) as any);

      const result = await subscriberService.deleteSubscriber('user@test.com');
      expect(result).toBe(true);
      expect(db.delete).toHaveBeenCalled();
    });

    it('returns false when subscriber not found', async () => {
      const { db } = await import('../../lib/db.js');
      vi.mocked(db.delete).mockImplementation(() => createChain([], { rowCount: 0 }) as any);

      const result = await subscriberService.deleteSubscriber('unknown@test.com');
      expect(result).toBe(false);
    });
  });

  describe('onUserSignup', () => {
    it('adds to free-new and removes from cold-leads and subscribers', async () => {
      const { db } = await import('../../lib/db.js');

      await subscriberService.onUserSignup('user@test.com', 'User');

      // Should call insert (addToList) and delete (removeFromLists)
      expect(db.insert).toHaveBeenCalled();
      expect(db.delete).toHaveBeenCalled();
    });

    it('handles DB failure gracefully', async () => {
      const { db } = await import('../../lib/db.js');
      vi.mocked(db.insert).mockImplementation(() => {
        throw new Error('DB error');
      });

      // Should not throw
      await expect(subscriberService.onUserSignup('user@test.com')).resolves.toBeUndefined();
    });
  });

  describe('onFirstScanComplete', () => {
    it('moves subscriber from free-new to free-scanned', async () => {
      const { db } = await import('../../lib/db.js');
      selectResult = [{ name: 'User', attributes: {} }];

      await subscriberService.onFirstScanComplete('user@test.com');

      expect(db.insert).toHaveBeenCalled(); // addToList
      expect(db.delete).toHaveBeenCalled(); // removeFromLists
    });
  });

  describe('onTrialStart', () => {
    it('moves subscriber to trial-new', async () => {
      const { db } = await import('../../lib/db.js');
      selectResult = [{ name: 'User', attributes: {} }];

      await subscriberService.onTrialStart('user@test.com');

      expect(db.insert).toHaveBeenCalled();
      expect(db.delete).toHaveBeenCalled();
    });
  });

  describe('onPayment', () => {
    it('moves subscriber to paid-pro', async () => {
      const { db } = await import('../../lib/db.js');
      selectResult = [{ name: 'User', attributes: {} }];

      await subscriberService.onPayment('user@test.com', 'pro');

      expect(db.insert).toHaveBeenCalled();
      expect(db.delete).toHaveBeenCalled();
    });

    it('moves subscriber to paid-team', async () => {
      const { db } = await import('../../lib/db.js');
      selectResult = [{ name: 'User', attributes: {} }];

      await subscriberService.onPayment('user@test.com', 'team');

      expect(db.insert).toHaveBeenCalled();
      expect(db.delete).toHaveBeenCalled();
    });
  });

  describe('onChurn', () => {
    it('moves paid subscriber to subscribers list and clears drip log', async () => {
      const { db } = await import('../../lib/db.js');
      selectResult = [{ name: 'User', attributes: {} }];

      // Mock update for updateAttribsByEmail
      vi.mocked(db.update).mockImplementation(() => createChain([], { rowCount: 1 }) as any);

      await subscriberService.onChurn('user@test.com');

      expect(db.insert).toHaveBeenCalled(); // addToList for subscribers

      const { clearDripLog } = await import('../../services/dripSchedulerService.js');
      expect(clearDripLog).toHaveBeenCalledWith('user@test.com', 'subscribers');
    });

    it('keeps trial subscriber in trial-active and sets trial_cancelled_at', async () => {
      const { db } = await import('../../lib/db.js');

      // Mock update for updateAttribsByEmail
      vi.mocked(db.update).mockImplementation(() => createChain([], { rowCount: 1 }) as any);

      await subscriberService.onChurn('user@test.com', true);

      // Should add to trial-active (insert) and remove from trial-new (delete)
      expect(db.insert).toHaveBeenCalled();
      expect(db.delete).toHaveBeenCalled();
      // Should update attributes with trial_cancelled_at
      expect(db.update).toHaveBeenCalled();
    });
  });

  describe('queryByList', () => {
    it('returns subscribers for a list', async () => {
      selectResult = [
        { email: 'a@test.com', name: 'A', attributes: {}, createdAt: new Date('2025-01-01') },
      ];

      const result = await subscriberService.queryByList('free-new');
      expect(result).toHaveLength(1);
      expect(result[0].email).toBe('a@test.com');
    });

    it('returns empty array when no subscribers', async () => {
      selectResult = [];

      const result = await subscriberService.queryByList('free-new');
      expect(result).toEqual([]);
    });
  });

  describe('updateAttribsByEmail', () => {
    it('updates attributes on all rows for email', async () => {
      const { db } = await import('../../lib/db.js');
      vi.mocked(db.update).mockImplementation(() => createChain([], { rowCount: 1 }) as any);

      const result = await subscriberService.updateAttribsByEmail('user@test.com', {
        new_key: 'new_value',
      });
      expect(result).toBe(true);
      expect(db.update).toHaveBeenCalled();
    });

    it('returns false when no rows matched', async () => {
      const { db } = await import('../../lib/db.js');
      vi.mocked(db.update).mockImplementation(() => createChain([], { rowCount: 0 }) as any);

      const result = await subscriberService.updateAttribsByEmail('unknown@test.com', { k: 'v' });
      expect(result).toBe(false);
    });

    it('returns false on DB error', async () => {
      const { db } = await import('../../lib/db.js');
      vi.mocked(db.update).mockImplementation(() => {
        throw new Error('DB error');
      });

      const result = await subscriberService.updateAttribsByEmail('user@test.com', { k: 'v' });
      expect(result).toBe(false);
    });
  });

  describe('cleanupExpiredTrialActive', () => {
    it('moves expired trial subscribers to subscribers list', async () => {
      const elevenDaysAgo = new Date(Date.now() - 11 * 86_400_000).toISOString();
      const { db } = await import('../../lib/db.js');

      // First select: queryByList returns expired subscriber
      // Subsequent selects: moveToList gets existing attrs
      let selectCall = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCall++;
        if (selectCall === 1) {
          return createChain([
            { email: 'expired@test.com', name: 'Expired', attributes: { trial_started_at: elevenDaysAgo }, createdAt: new Date('2025-01-01') },
          ]) as any;
        }
        return createChain([{ name: 'Expired', attributes: { trial_started_at: elevenDaysAgo } }]) as any;
      });

      vi.mocked(db.update).mockImplementation(() => createChain([], { rowCount: 1 }) as any);

      await subscriberService.cleanupExpiredTrialActive();

      // Should have moved subscriber and updated attributes
      expect(db.insert).toHaveBeenCalled();
      expect(db.delete).toHaveBeenCalled();
      expect(db.update).toHaveBeenCalled();

      const { clearDripLog } = await import('../../services/dripSchedulerService.js');
      expect(clearDripLog).toHaveBeenCalledWith('expired@test.com', 'trial-active');
      expect(clearDripLog).toHaveBeenCalledWith('expired@test.com', 'subscribers');
    });

    it('skips subscribers whose trial started less than 10 days ago', async () => {
      const fiveDaysAgo = new Date(Date.now() - 5 * 86_400_000).toISOString();

      selectResult = [
        { email: 'active@test.com', name: 'Active', attributes: { trial_started_at: fiveDaysAgo }, createdAt: new Date('2025-01-01') },
      ];

      const { db } = await import('../../lib/db.js');
      await subscriberService.cleanupExpiredTrialActive();

      // Should only have the queryByList select — no move calls
      expect(db.insert).not.toHaveBeenCalled();
    });
  });
});
