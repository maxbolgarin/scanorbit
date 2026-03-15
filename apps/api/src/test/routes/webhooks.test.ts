import { describe, it, expect, vi, beforeEach } from 'vitest';
import { jsonBody } from '../setup.js';
import { Hono } from 'hono';
import { createChain } from '../helpers/mockDb.js';

let dbUpdateResult: unknown[] = [];

vi.mock('../../lib/db.js', () => ({
  db: {
    update: vi.fn(() => createChain(dbUpdateResult)),
  },
  pool: {},
}));

vi.mock('../../lib/config.js', () => ({
  config: {
    email: {
      resend: {
        webhookSecret: '', // Disable signature verification in tests
      },
    },
  },
}));

vi.mock('../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../db/schema.js', () => ({
  emailSubscribers: {
    email: 'email',
    status: 'status',
    updatedAt: 'updated_at',
  },
}));

vi.mock('svix', () => ({
  Webhook: vi.fn(),
}));

import webhooksRoute from '../../routes/webhooks.js';

const app = new Hono();
app.route('/webhooks', webhooksRoute);

describe('webhooks route', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    dbUpdateResult = [];

    const { db } = await import('../../lib/db.js');
    vi.mocked(db.update).mockImplementation(() => createChain(dbUpdateResult) as any);
  });

  describe('POST /webhooks/resend', () => {
    it('handles bounce event and updates subscriber status', async () => {
      const res = await app.request('/webhooks/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'email.bounced',
          data: { to: ['user@test.com'], email_id: 'email-123' },
        }),
      });

      expect(res.status).toBe(200);
      const body = await jsonBody(res);
      expect(body.received).toBe(true);

      const { db } = await import('../../lib/db.js');
      expect(db.update).toHaveBeenCalled();
    });

    it('handles complaint event and updates subscriber status', async () => {
      const res = await app.request('/webhooks/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'email.complained',
          data: { to: ['user@test.com'], email_id: 'email-456' },
        }),
      });

      expect(res.status).toBe(200);
      const body = await jsonBody(res);
      expect(body.received).toBe(true);

      const { db } = await import('../../lib/db.js');
      expect(db.update).toHaveBeenCalled();
    });

    it('ignores delivery events', async () => {
      const res = await app.request('/webhooks/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'email.delivered',
          data: { to: ['user@test.com'] },
        }),
      });

      expect(res.status).toBe(200);
      const body = await jsonBody(res);
      expect(body.received).toBe(true);

      const { db } = await import('../../lib/db.js');
      expect(db.update).not.toHaveBeenCalled();
    });

    it('handles events without type', async () => {
      const res = await app.request('/webhooks/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: {} }),
      });

      expect(res.status).toBe(200);
      const body = await jsonBody(res);
      expect(body.received).toBe(true);
    });

    it('handles invalid JSON', async () => {
      const res = await app.request('/webhooks/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json',
      });

      expect(res.status).toBe(400);
    });
  });
});
