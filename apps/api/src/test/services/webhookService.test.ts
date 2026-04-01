import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createChain } from '../helpers/mockDb.js';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

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
    selectDistinct: vi.fn(() => createChain([])),
  },
}));

vi.mock('../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../lib/crypto.js', () => ({
  encryptOAuthToken: vi.fn((v: string) => `encrypted:${v}`),
  decryptOAuthToken: vi.fn((v: string) => v.replace('encrypted:', '')),
}));

vi.mock('../../lib/config.js', () => ({
  config: {
    oauthEncryptionKey: 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
  },
}));

// ---------------------------------------------------------------------------
// Subject under test — import AFTER mocks
// ---------------------------------------------------------------------------
import { webhookService } from '../../services/webhookService.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

describe('webhookService', () => {
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

  // -------------------------------------------------------------------------
  // createWebhook
  // -------------------------------------------------------------------------

  describe('createWebhook', () => {
    it('creates webhook, returns secret, stores encrypted secret in DB', async () => {
      const webhook = makeWebhook();
      // First select: count check returns 0 webhooks
      selectResult = [{ count: 0 }];
      insertResult = [webhook];

      const { encryptOAuthToken } = await import('../../lib/crypto.js');

      const result = await webhookService.createWebhook('org-1', {
        url: 'https://example.com/hook',
        eventTypes: ['scan.completed'],
        description: 'Test webhook',
        createdBy: 'user-1',
      });

      expect(result.webhook).toEqual(webhook);
      // Secret is a 64-char hex string (32 bytes)
      expect(result.secret).toMatch(/^[0-9a-f]{64}$/);
      // Encrypted secret was passed to db.insert
      expect(encryptOAuthToken).toHaveBeenCalledWith(result.secret);
    });

    it('throws 400 when 10 webhooks already exist', async () => {
      selectResult = [{ count: 10 }];

      await expect(
        webhookService.createWebhook('org-1', {
          url: 'https://example.com/hook',
          eventTypes: [],
          createdBy: 'user-1',
        })
      ).rejects.toThrow('Maximum 10 webhooks');
    });
  });

  // -------------------------------------------------------------------------
  // listWebhooks
  // -------------------------------------------------------------------------

  describe('listWebhooks', () => {
    it('returns all webhooks for org', async () => {
      const webhooks = [makeWebhook(), makeWebhook({ id: 'webhook-2' })];
      selectResult = webhooks;

      const result = await webhookService.listWebhooks('org-1');
      expect(result).toEqual(webhooks);
      expect(result).toHaveLength(2);
    });

    it('returns empty array when no webhooks exist', async () => {
      selectResult = [];
      const result = await webhookService.listWebhooks('org-1');
      expect(result).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // updateWebhook
  // -------------------------------------------------------------------------

  describe('updateWebhook', () => {
    it('updates specified fields and returns updated webhook', async () => {
      const updated = makeWebhook({ url: 'https://new.example.com/hook', isActive: false });
      updateResult = [updated];

      const result = await webhookService.updateWebhook('org-1', 'webhook-1', {
        url: 'https://new.example.com/hook',
        isActive: false,
      });

      expect(result).toEqual(updated);
    });

    it('throws 404 for non-existent webhook', async () => {
      updateResult = [];

      await expect(
        webhookService.updateWebhook('org-1', 'nonexistent', { url: 'https://x.com' })
      ).rejects.toThrow('Webhook not found');
    });
  });

  // -------------------------------------------------------------------------
  // deleteWebhook
  // -------------------------------------------------------------------------

  describe('deleteWebhook', () => {
    it('deletes webhook successfully', async () => {
      deleteResult = [{ id: 'webhook-1' }];

      await expect(webhookService.deleteWebhook('org-1', 'webhook-1')).resolves.toBeUndefined();
    });

    it('throws 404 when webhook does not belong to org', async () => {
      deleteResult = [];

      await expect(webhookService.deleteWebhook('org-1', 'nonexistent')).rejects.toThrow(
        'Webhook not found'
      );
    });
  });

  // -------------------------------------------------------------------------
  // testWebhook
  // -------------------------------------------------------------------------

  describe('testWebhook', () => {
    it('sends test payload with correct HMAC signature', async () => {
      const webhook = makeWebhook({ secret: 'encrypted:mysecret' });
      selectResult = [webhook];

      const mockResponse = { status: 200 } as Response;
      const mockFetch = vi.fn().mockResolvedValue(mockResponse);
      vi.stubGlobal('fetch', mockFetch);

      const result = await webhookService.testWebhook('org-1', 'webhook-1');

      expect(result.statusCode).toBe(200);
      expect(result.success).toBe(true);

      // Verify fetch was called with correct URL and headers
      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(webhook.url);
      expect((options.headers as Record<string, string>)['Content-Type']).toBe('application/json');
      expect((options.headers as Record<string, string>)['X-ScanOrbit-Event']).toBe('test');

      // Signature should be present and correctly formatted
      const sig = (options.headers as Record<string, string>)['X-ScanOrbit-Signature'];
      expect(sig).toMatch(/^sha256=[0-9a-f]{64}$/);

      // Verify signature is correct HMAC over the body
      const crypto = await import('node:crypto');
      const expectedSig = crypto
        .createHmac('sha256', 'mysecret')
        .update(options.body as string)
        .digest('hex');
      expect(sig).toBe(`sha256=${expectedSig}`);

      vi.unstubAllGlobals();
    });

    it('returns success=false for non-2xx response', async () => {
      const webhook = makeWebhook();
      selectResult = [webhook];

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 500 }));

      const result = await webhookService.testWebhook('org-1', 'webhook-1');
      expect(result.statusCode).toBe(500);
      expect(result.success).toBe(false);

      vi.unstubAllGlobals();
    });

    it('returns statusCode=0 and success=false when fetch throws', async () => {
      const webhook = makeWebhook();
      selectResult = [webhook];

      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

      const result = await webhookService.testWebhook('org-1', 'webhook-1');
      expect(result.statusCode).toBe(0);
      expect(result.success).toBe(false);

      vi.unstubAllGlobals();
    });

    it('throws 404 when webhook not found', async () => {
      selectResult = [];

      await expect(webhookService.testWebhook('org-1', 'nonexistent')).rejects.toThrow(
        'Webhook not found'
      );
    });
  });

  // -------------------------------------------------------------------------
  // getDeliveryLogs
  // -------------------------------------------------------------------------

  describe('getDeliveryLogs', () => {
    it('returns paginated delivery logs', async () => {
      const webhook = makeWebhook();
      const logs = [
        {
          id: 'log-1',
          webhookId: 'webhook-1',
          eventType: 'scan.completed',
          payload: {},
          statusCode: 200,
          responseBody: 'OK',
          attempts: 1,
          status: 'success',
          nextRetryAt: null,
          error: null,
          createdAt: new Date('2024-01-02'),
        },
      ];

      let callCount = 0;
      const { db } = await import('../../lib/db.js');

      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) return createChain([webhook]) as any; // ownership check
        if (callCount === 2) return createChain(logs) as any;      // data query
        return createChain([{ count: 1 }]) as any;                 // count query
      });

      const result = await webhookService.getDeliveryLogs('org-1', 'webhook-1', 1, 10);

      expect(result.data).toEqual(logs);
      expect(result.total).toBe(1);
    });

    it('throws 404 when webhook does not belong to org', async () => {
      selectResult = [];

      await expect(
        webhookService.getDeliveryLogs('org-1', 'nonexistent', 1, 10)
      ).rejects.toThrow('Webhook not found');
    });
  });
});
