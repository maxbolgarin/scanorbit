import { describe, it, expect, vi, beforeEach } from 'vitest';
import { jsonBody } from '../setup.js';
import { Hono } from 'hono';

vi.mock('../../lib/config.js', () => ({
  listmonkConfig: {
    apiUrl: 'http://listmonk:9000',
    apiUser: 'user',
    apiPassword: 'pass',
  },
}));

vi.mock('../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Mock fetch globally
const mockFetch = vi.fn().mockResolvedValue({ ok: true, text: async () => '' });
vi.stubGlobal('fetch', mockFetch);

import webhooksRoute from '../../routes/webhooks.js';

const app = new Hono();
app.route('/webhooks', webhooksRoute);

describe('webhooks route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({ ok: true, text: async () => '' });
  });

  describe('POST /webhooks/scaleway-bounce', () => {
    it('handles bounce event and forwards to Listmonk', async () => {
      const res = await app.request('/webhooks/scaleway-bounce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'email_dropped',
          payload: { rcpt_to: 'user@test.com' },
        }),
      });

      expect(res.status).toBe(200);
      const body = await jsonBody(res);
      expect(body.received).toBe(true);
      expect(mockFetch).toHaveBeenCalled();
    });

    it('ignores non-bounce events', async () => {
      const res = await app.request('/webhooks/scaleway-bounce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'email_delivered' }),
      });

      expect(res.status).toBe(200);
      const body = await jsonBody(res);
      expect(body.ignored).toBe(true);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('handles missing rcpt_to', async () => {
      const res = await app.request('/webhooks/scaleway-bounce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'email_mailbox_not_found',
          payload: {},
        }),
      });

      expect(res.status).toBe(200);
      const body = await jsonBody(res);
      expect(body.error).toBe('missing rcpt_to');
    });

    it('handles invalid JSON', async () => {
      const res = await app.request('/webhooks/scaleway-bounce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json',
      });

      expect(res.status).toBe(400);
    });

    it('returns 200 even if Listmonk fails', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const res = await app.request('/webhooks/scaleway-bounce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'email_dropped',
          payload: { rcpt_to: 'user@test.com' },
        }),
      });

      expect(res.status).toBe(200);
    });
  });
});
