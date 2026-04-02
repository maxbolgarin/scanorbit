import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createChain } from '../helpers/mockDb.js';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

let selectResult: unknown[] = [];
let insertResult: unknown[] = [];
let updateResult: unknown[] = [];

const { mockRedis } = vi.hoisted(() => ({
  mockRedis: {
    rpush: vi.fn().mockResolvedValue(1),
    lpop: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
  },
}));

vi.mock('../../lib/db.js', () => ({
  db: {
    select: vi.fn(() => createChain(selectResult)),
    insert: vi.fn(() => createChain(insertResult)),
    update: vi.fn(() => createChain(updateResult)),
  },
}));

vi.mock('../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../lib/crypto.js', () => ({
  decryptOAuthToken: vi.fn((v: string) => v.replace('encrypted:', '')),
}));

vi.mock('../../lib/config.js', () => ({
  config: {
    oauthEncryptionKey: 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
  },
}));

vi.mock('../../lib/redis.js', () => ({
  redis: mockRedis,
}));

// ---------------------------------------------------------------------------
// Subject under test — import AFTER mocks
// ---------------------------------------------------------------------------
import { webhookDeliveryService } from '../../services/webhookDeliveryService.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeDelivery = (overrides: Record<string, unknown> = {}) => ({
  id: 'delivery-1',
  webhookId: 'webhook-1',
  eventType: 'scan.completed',
  payload: { scan: 'result' },
  statusCode: null,
  responseBody: null,
  attempts: 0,
  status: 'pending',
  nextRetryAt: null,
  error: null,
  createdAt: new Date('2024-01-01'),
  ...overrides,
});

const makeWebhook = (overrides: Record<string, unknown> = {}) => ({
  id: 'webhook-1',
  orgId: 'org-1',
  url: 'https://example.com/hook',
  secret: 'encrypted:mysecret',
  eventTypes: ['scan.completed'],
  isActive: true,
  description: 'Test webhook',
  createdBy: 'user-1',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  ...overrides,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('webhookDeliveryService', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    selectResult = [];
    insertResult = [];
    updateResult = [];

    // Restore mock implementations after clearAllMocks
    const { db } = await import('../../lib/db.js');
    vi.mocked(db.select).mockImplementation(() => createChain(selectResult) as any);
    vi.mocked(db.insert).mockImplementation(() => createChain(insertResult) as any);
    vi.mocked(db.update).mockImplementation(() => createChain(updateResult) as any);

    mockRedis.rpush.mockResolvedValue(1);
    mockRedis.lpop.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue('OK');
  });

  // -------------------------------------------------------------------------
  // signPayload
  // -------------------------------------------------------------------------

  describe('signPayload', () => {
    it('returns correct HMAC-SHA256 hex digest', async () => {
      const crypto = await import('node:crypto');
      const secret = 'mysecret';
      const payload = '{"test":true}';

      const result = webhookDeliveryService.signPayload(secret, payload);

      const expected = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      expect(result).toBe(expected);
      expect(result).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  // -------------------------------------------------------------------------
  // enqueueDelivery
  // -------------------------------------------------------------------------

  describe('enqueueDelivery', () => {
    it('inserts delivery record and pushes to Redis queue', async () => {
      const delivery = makeDelivery();
      insertResult = [delivery];

      const deliveryId = await webhookDeliveryService.enqueueDelivery(
        'webhook-1',
        'scan.completed',
        { scan: 'result' }
      );

      expect(deliveryId).toBe('delivery-1');

      const { db } = await import('../../lib/db.js');
      expect(db.insert).toHaveBeenCalledOnce();
      expect(mockRedis.rpush).toHaveBeenCalledWith('jobs:webhook_delivery', 'delivery-1');
    });
  });

  // -------------------------------------------------------------------------
  // deliverWebhook
  // -------------------------------------------------------------------------

  describe('deliverWebhook', () => {
    it('delivers successfully on 2xx response', async () => {
      const delivery = makeDelivery();
      const webhook = makeWebhook();

      const { db } = await import('../../lib/db.js');
      let selectCallCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) return createChain([delivery]) as any;
        return createChain([webhook]) as any;
      });

      const mockResponse = {
        status: 200,
        text: vi.fn().mockResolvedValue('OK'),
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

      await webhookDeliveryService.deliverWebhook('delivery-1');

      expect(db.update).toHaveBeenCalledOnce();
      const updateChain = vi.mocked(db.update).mock.results[0].value;
      expect(updateChain.set).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'success', statusCode: 200 })
      );

      vi.unstubAllGlobals();
    });

    it('re-enqueues with retry on failure when attempts < 3', async () => {
      const delivery = makeDelivery({ attempts: 0 });
      const webhook = makeWebhook();

      const { db } = await import('../../lib/db.js');
      let selectCallCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) return createChain([delivery]) as any;
        return createChain([webhook]) as any;
      });

      const mockResponse = {
        status: 500,
        text: vi.fn().mockResolvedValue('Internal Server Error'),
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

      await webhookDeliveryService.deliverWebhook('delivery-1');

      // Should update with incremented attempts and nextRetryAt
      expect(db.update).toHaveBeenCalledOnce();
      const updateChain = vi.mocked(db.update).mock.results[0].value;
      expect(updateChain.set).toHaveBeenCalledWith(
        expect.objectContaining({ attempts: 1, error: 'HTTP 500' })
      );
      const setArgs = vi.mocked(updateChain.set).mock.calls[0][0] as Record<string, unknown>;
      expect(setArgs.nextRetryAt).toBeInstanceOf(Date);

      // Should re-enqueue
      expect(mockRedis.rpush).toHaveBeenCalledWith('jobs:webhook_delivery', 'delivery-1');

      vi.unstubAllGlobals();
    });

    it('marks as failed after max retries (attempts >= 3)', async () => {
      const delivery = makeDelivery({ attempts: 2 });
      const webhook = makeWebhook();

      const { db } = await import('../../lib/db.js');
      let selectCallCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) return createChain([delivery]) as any;
        return createChain([webhook]) as any;
      });

      const mockResponse = {
        status: 503,
        text: vi.fn().mockResolvedValue('Service Unavailable'),
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

      await webhookDeliveryService.deliverWebhook('delivery-1');

      // Should mark as failed
      const updateChain = vi.mocked(db.update).mock.results[0].value;
      expect(updateChain.set).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'failed', attempts: 3, error: 'HTTP 503' })
      );

      // Should NOT re-enqueue
      expect(mockRedis.rpush).not.toHaveBeenCalled();

      vi.unstubAllGlobals();
    });

    it('handles network error and retries when attempts < 3', async () => {
      const delivery = makeDelivery({ attempts: 0 });
      const webhook = makeWebhook();

      const { db } = await import('../../lib/db.js');
      let selectCallCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) return createChain([delivery]) as any;
        return createChain([webhook]) as any;
      });

      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));

      await webhookDeliveryService.deliverWebhook('delivery-1');

      // Network error should be stored as error message, and delivery re-enqueued
      const updateChain = vi.mocked(db.update).mock.results[0].value;
      expect(updateChain.set).toHaveBeenCalledWith(
        expect.objectContaining({ attempts: 1, error: 'ECONNREFUSED' })
      );
      expect(mockRedis.rpush).toHaveBeenCalledWith('jobs:webhook_delivery', 'delivery-1');

      vi.unstubAllGlobals();
    });

    it('skips delivery when record not found', async () => {
      const { db } = await import('../../lib/db.js');
      vi.mocked(db.select).mockImplementation(() => createChain([]) as any);

      const mockFetch = vi.fn();
      vi.stubGlobal('fetch', mockFetch);

      await webhookDeliveryService.deliverWebhook('nonexistent');

      expect(mockFetch).not.toHaveBeenCalled();
      expect(db.update).not.toHaveBeenCalled();

      vi.unstubAllGlobals();
    });

    it('marks as failed when webhook is inactive', async () => {
      const delivery = makeDelivery();
      const webhook = makeWebhook({ isActive: false });

      const { db } = await import('../../lib/db.js');
      let selectCallCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) return createChain([delivery]) as any;
        return createChain([webhook]) as any;
      });

      await webhookDeliveryService.deliverWebhook('delivery-1');

      const updateChain = vi.mocked(db.update).mock.results[0].value;
      expect(updateChain.set).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'failed', error: 'Webhook not found or inactive' })
      );
    });
  });

  // -------------------------------------------------------------------------
  // processOne
  // -------------------------------------------------------------------------

  describe('processOne', () => {
    it('returns false when queue is empty', async () => {
      mockRedis.lpop.mockResolvedValue(null);

      const result = await webhookDeliveryService.processOne();
      expect(result).toBe(false);
    });

    it('processes delivery and returns true when item in queue', async () => {
      const delivery = makeDelivery();
      const webhook = makeWebhook();

      mockRedis.lpop.mockResolvedValue('delivery-1');

      const { db } = await import('../../lib/db.js');
      let selectCallCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) return createChain([delivery]) as any;
        return createChain([webhook]) as any;
      });

      const mockResponse = {
        status: 200,
        text: vi.fn().mockResolvedValue('OK'),
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

      const result = await webhookDeliveryService.processOne();
      expect(result).toBe(true);

      vi.unstubAllGlobals();
    });
  });
});
