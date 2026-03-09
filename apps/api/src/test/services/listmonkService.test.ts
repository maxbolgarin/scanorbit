import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFetch } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
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

vi.mock('../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Replace global fetch
vi.stubGlobal('fetch', mockFetch);

import { listmonkService } from '../../services/listmonkService.js';

function jsonResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(data),
    text: vi.fn().mockResolvedValue(JSON.stringify(data)),
  } as unknown as Response;
}

describe('listmonkService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  describe('isConfigured', () => {
    it('returns true when apiPassword is set', () => {
      expect(listmonkService.isConfigured()).toBe(true);
    });
  });

  describe('listsConfigured', () => {
    it('returns true when password and list IDs are set', () => {
      expect(listmonkService.listsConfigured()).toBe(true);
    });
  });

  describe('subscribe', () => {
    it('creates subscriber via API', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ data: { id: 1, email: 'user@test.com', name: 'User', status: 'enabled' } }));

      const result = await listmonkService.subscribe('user@test.com', 'User');
      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/api/subscribers');
      expect(opts.method).toBe('POST');
      const body = JSON.parse(opts.body);
      expect(body.email).toBe('user@test.com');
      expect(body.name).toBe('User');
    });

    it('returns false on API error', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ message: 'error' }, 500));

      const result = await listmonkService.subscribe('user@test.com');
      expect(result).toBe(false);
    });

    it('returns false on network error', async () => {
      mockFetch.mockRejectedValue(new Error('network error'));

      const result = await listmonkService.subscribe('user@test.com');
      expect(result).toBe(false);
    });

    it('uses default list when no listIds provided', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ data: { id: 1 } }));

      await listmonkService.subscribe('user@test.com');
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.lists).toEqual([{ id: 1 }]);
    });

    it('uses custom listIds when provided', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ data: { id: 1 } }));

      await listmonkService.subscribe('user@test.com', null, [3, 4]);
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.lists).toEqual([{ id: 3 }, { id: 4 }]);
    });
  });

  describe('unsubscribe', () => {
    it('blocklists subscriber', async () => {
      // First call: getSubscriberByEmail search
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ data: { results: [{ id: 42, email: 'user@test.com', name: 'User', status: 'enabled' }] } }),
      );
      // Second call: PUT to blocklist
      mockFetch.mockResolvedValueOnce(jsonResponse({ data: {} }));

      const result = await listmonkService.unsubscribe('user@test.com');
      expect(result).toBe(true);

      const [url, opts] = mockFetch.mock.calls[1];
      expect(url).toContain('/api/subscribers/42');
      expect(opts.method).toBe('PUT');
      const body = JSON.parse(opts.body);
      expect(body.status).toBe('blocklisted');
    });

    it('returns false when subscriber not found', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ data: { results: [] } }));

      const result = await listmonkService.unsubscribe('unknown@test.com');
      expect(result).toBe(false);
    });
  });

  describe('deleteSubscriber', () => {
    it('deletes subscriber via API', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ data: { results: [{ id: 42 }] } }),
      );
      mockFetch.mockResolvedValueOnce(jsonResponse({ data: {} }));

      const result = await listmonkService.deleteSubscriber('user@test.com');
      expect(result).toBe(true);

      const [url, opts] = mockFetch.mock.calls[1];
      expect(url).toContain('/api/subscribers/42');
      expect(opts.method).toBe('DELETE');
    });

    it('returns false when subscriber not found', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ data: { results: [] } }));

      const result = await listmonkService.deleteSubscriber('unknown@test.com');
      expect(result).toBe(false);
    });
  });

  describe('onUserSignup', () => {
    it('ensures subscriber and adds to free-new', async () => {
      // getSubscriberByEmail (ensureSubscriber lookup)
      mockFetch.mockResolvedValueOnce(jsonResponse({ data: { results: [{ id: 10 }] } }));
      // addToLists
      mockFetch.mockResolvedValueOnce(jsonResponse({ data: {} }));
      // removeFromLists
      mockFetch.mockResolvedValueOnce(jsonResponse({ data: {} }));

      await listmonkService.onUserSignup('user@test.com', 'User');

      // addToLists call
      const addBody = JSON.parse(mockFetch.mock.calls[1][1].body);
      expect(addBody.target_list_ids).toContain(3); // freeNew
      expect(addBody.action).toBe('add');
    });

    it('handles API failure gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('API down'));

      // Should not throw
      await expect(listmonkService.onUserSignup('user@test.com')).resolves.toBeUndefined();
    });
  });

  describe('onFirstScanComplete', () => {
    it('moves subscriber from free-new to free-scanned', async () => {
      // getSubscriberByEmail
      mockFetch.mockResolvedValueOnce(jsonResponse({ data: { results: [{ id: 10 }] } }));
      // removeFromLists (free-new)
      mockFetch.mockResolvedValueOnce(jsonResponse({ data: {} }));
      // addToLists (free-scanned)
      mockFetch.mockResolvedValueOnce(jsonResponse({ data: {} }));

      await listmonkService.onFirstScanComplete('user@test.com');
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('skips if subscriber not found', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ data: { results: [] } }));

      await listmonkService.onFirstScanComplete('unknown@test.com');
      // Only the lookup call
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('onTrialStart', () => {
    it('moves subscriber to trial-new', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ data: { results: [{ id: 10 }] } }));
      mockFetch.mockResolvedValueOnce(jsonResponse({ data: {} }));
      mockFetch.mockResolvedValueOnce(jsonResponse({ data: {} }));

      await listmonkService.onTrialStart('user@test.com');
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('onPayment', () => {
    it('moves subscriber to paid-pro for pro tier', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ data: { results: [{ id: 10 }] } }));
      mockFetch.mockResolvedValueOnce(jsonResponse({ data: {} }));
      mockFetch.mockResolvedValueOnce(jsonResponse({ data: {} }));

      await listmonkService.onPayment('user@test.com', 'pro');

      // addToLists call (third call)
      const addBody = JSON.parse(mockFetch.mock.calls[2][1].body);
      expect(addBody.target_list_ids).toContain(7); // paidPro
    });

    it('moves subscriber to paid-team for team tier', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ data: { results: [{ id: 10 }] } }));
      mockFetch.mockResolvedValueOnce(jsonResponse({ data: {} }));
      mockFetch.mockResolvedValueOnce(jsonResponse({ data: {} }));

      await listmonkService.onPayment('user@test.com', 'team');

      const addBody = JSON.parse(mockFetch.mock.calls[2][1].body);
      expect(addBody.target_list_ids).toContain(8); // paidTeam
    });
  });

  describe('onChurn', () => {
    it('moves subscriber to subscribers list', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ data: { results: [{ id: 10 }] } }));
      mockFetch.mockResolvedValueOnce(jsonResponse({ data: {} }));
      mockFetch.mockResolvedValueOnce(jsonResponse({ data: {} }));

      await listmonkService.onChurn('user@test.com');

      const addBody = JSON.parse(mockFetch.mock.calls[2][1].body);
      expect(addBody.target_list_ids).toContain(2); // subscribers
    });
  });

  describe('sendTx', () => {
    it('sends transactional email', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ data: {} }));

      const result = await listmonkService.sendTx({
        email: 'user@test.com',
        templateId: 41,
        data: { first_name: 'John' },
      });

      expect(result).toBe(true);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/api/tx');
      const body = JSON.parse(opts.body);
      expect(body.subscriber_email).toBe('user@test.com');
      expect(body.template_id).toBe(41);
    });

    it('returns false when templateId is 0', async () => {
      const result = await listmonkService.sendTx({
        email: 'user@test.com',
        templateId: 0,
      });

      expect(result).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('includes fromEmail when provided', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ data: {} }));

      await listmonkService.sendTx({
        email: 'user@test.com',
        templateId: 41,
        fromEmail: 'Maksim <maksim@scanorbit.cloud>',
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.from_email).toBe('Maksim <maksim@scanorbit.cloud>');
    });

    it('returns false on API error', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ message: 'error' }, 500));

      const result = await listmonkService.sendTx({
        email: 'user@test.com',
        templateId: 41,
      });
      expect(result).toBe(false);
    });
  });

  describe('queryByList', () => {
    it('returns subscribers for a list', async () => {
      mockFetch.mockResolvedValue(
        jsonResponse({
          data: {
            results: [
              { id: 1, email: 'a@test.com', name: 'A', attribs: {}, created_at: '2025-01-01' },
            ],
          },
        }),
      );

      const result = await listmonkService.queryByList(3);
      expect(result).toHaveLength(1);
      expect(result[0].email).toBe('a@test.com');
    });

    it('returns empty array for listId 0', async () => {
      const result = await listmonkService.queryByList(0);
      expect(result).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('returns empty array on API error', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ message: 'error' }, 500));

      const result = await listmonkService.queryByList(3);
      expect(result).toEqual([]);
    });
  });

  describe('updateAttribsByEmail', () => {
    it('merges attributes with existing ones', async () => {
      // getSubscriberByEmail
      mockFetch.mockResolvedValueOnce(jsonResponse({ data: { results: [{ id: 10 }] } }));
      // GET subscriber details
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          data: {
            email: 'user@test.com',
            name: 'User',
            status: 'enabled',
            attribs: { existing: 'value' },
          },
        }),
      );
      // PUT update
      mockFetch.mockResolvedValueOnce(jsonResponse({ data: {} }));

      const result = await listmonkService.updateAttribsByEmail('user@test.com', {
        new_key: 'new_value',
      });
      expect(result).toBe(true);

      const putBody = JSON.parse(mockFetch.mock.calls[2][1].body);
      expect(putBody.attribs).toEqual({ existing: 'value', new_key: 'new_value' });
    });

    it('returns false when subscriber not found', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ data: { results: [] } }));

      const result = await listmonkService.updateAttribsByEmail('unknown@test.com', { k: 'v' });
      expect(result).toBe(false);
    });
  });
});
