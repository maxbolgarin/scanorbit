import { describe, it, expect, vi, beforeEach } from 'vitest';
import { jsonBody } from '../setup.js';
import { Hono } from 'hono';
import type { Variables } from '../../types/index.js';
import crypto from 'crypto';

// ─── Auth middleware mock ─────────────────────────────────────────────────────
vi.mock('../../middlewares/auth.js', () => ({
  requireAuth: vi.fn(async (c: any, next: any) => {
    c.set('userId', 'test-user-id');
    c.set('orgId', 'test-org-id');
    await next();
  }),
}));

vi.mock('../../middlewares/requireOrgId.js', () => ({
  requireOrgId: vi.fn(async (c: any, next: any) => { await next(); }),
}));

// ─── Service mocks ────────────────────────────────────────────────────────────
const { mockWebhookService, mockVerifyOrgAdmin, mockNotificationPreferenceService, mockSlackService } = vi.hoisted(() => ({
  mockWebhookService: {
    createWebhook: vi.fn(),
    listWebhooks: vi.fn(),
    updateWebhook: vi.fn(),
    deleteWebhook: vi.fn(),
    testWebhook: vi.fn(),
    getDeliveryLogs: vi.fn(),
  },
  mockVerifyOrgAdmin: vi.fn(),
  mockNotificationPreferenceService: {
    getPreferences: vi.fn(),
    updatePreferences: vi.fn(),
  },
  mockSlackService: {
    listIntegrations: vi.fn(),
    deleteIntegration: vi.fn(),
    sendTestMessage: vi.fn(),
    getOAuthUrl: vi.fn(),
    handleOAuthCallback: vi.fn(),
  },
}));

vi.mock('../../services/webhookService.js', () => ({
  webhookService: mockWebhookService,
}));

vi.mock('../../services/notificationPreferenceService.js', () => ({
  notificationPreferenceService: mockNotificationPreferenceService,
}));

vi.mock('../../services/slackService.js', () => ({
  slackService: mockSlackService,
}));

vi.mock('../../services/orgService.js', () => ({
  verifyOrgAdmin: mockVerifyOrgAdmin,
}));

vi.mock('../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../lib/metrics.js', () => ({
  errorsTotal: { inc: vi.fn() },
}));

// ─── Import route and error handler ──────────────────────────────────────────
import integrationsRoute from '../../routes/integrations.js';
import { errorHandler } from '../../middlewares/errorHandler.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function createWebhook(overrides: Record<string, unknown> = {}) {
  return {
    id: crypto.randomUUID(),
    orgId: 'test-org-id',
    url: 'https://example.com/webhook',
    secret: 'encrypted-secret',
    eventTypes: ['scan.completed'],
    description: null,
    isActive: true,
    createdBy: 'test-user-id',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function createDeliveryLog(overrides: Record<string, unknown> = {}) {
  return {
    id: crypto.randomUUID(),
    webhookId: 'webhook-1',
    eventType: 'scan.completed',
    payload: { event: 'scan.completed' },
    status: 'success',
    statusCode: 200,
    responseBody: 'ok',
    attempts: 1,
    error: null,
    nextRetryAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────
describe('Integrations Routes', () => {
  let app: Hono<{ Variables: Variables }>;

  beforeEach(() => {
    app = new Hono<{ Variables: Variables }>();
    app.route('/integrations', integrationsRoute);
    app.onError(errorHandler);
    vi.clearAllMocks();
    mockVerifyOrgAdmin.mockResolvedValue(undefined);
  });

  // ─── POST /integrations/webhooks ───────────────────────────────────────────
  describe('POST /integrations/webhooks', () => {
    it('creates webhook (happy path)', async () => {
      const webhook = createWebhook();
      mockWebhookService.createWebhook.mockResolvedValue({ webhook, secret: 'raw-secret-abc' });

      const res = await app.request('/integrations/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: 'https://example.com/webhook',
          eventTypes: ['scan.completed'],
          description: 'My webhook',
        }),
      });

      expect(res.status).toBe(201);
      const body = await jsonBody(res);
      expect(body.data.webhook).toBeDefined();
      expect(body.data.secret).toBe('raw-secret-abc');
      expect(mockWebhookService.createWebhook).toHaveBeenCalledWith('test-org-id', {
        url: 'https://example.com/webhook',
        eventTypes: ['scan.completed'],
        description: 'My webhook',
        createdBy: 'test-user-id',
      });
    });


    it('returns 400 for invalid URL', async () => {
      const res = await app.request('/integrations/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: 'not-a-url',
          eventTypes: ['scan.completed'],
        }),
      });

      expect(res.status).toBe(400);
    });

    it('returns 400 for empty eventTypes', async () => {
      const res = await app.request('/integrations/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: 'https://example.com/webhook',
          eventTypes: [],
        }),
      });

      expect(res.status).toBe(400);
    });
  });

  // ─── GET /integrations/webhooks ────────────────────────────────────────────
  describe('GET /integrations/webhooks', () => {
    it('lists webhooks without secret field', async () => {
      const webhooks = [createWebhook(), createWebhook()];
      mockWebhookService.listWebhooks.mockResolvedValue(webhooks);

      const res = await app.request('/integrations/webhooks');
      expect(res.status).toBe(200);
      const body = await jsonBody(res);
      expect(body.data).toHaveLength(2);
      // Ensure secret is stripped
      for (const w of body.data) {
        expect(w.secret).toBeUndefined();
      }
      expect(body.data[0].url).toBe('https://example.com/webhook');
    });

    it('returns empty array when no webhooks', async () => {
      mockWebhookService.listWebhooks.mockResolvedValue([]);

      const res = await app.request('/integrations/webhooks');
      expect(res.status).toBe(200);
      const body = await jsonBody(res);
      expect(body.data).toEqual([]);
    });
  });

  // ─── PATCH /integrations/webhooks/:id ─────────────────────────────────────
  describe('PATCH /integrations/webhooks/:id', () => {
    it('updates webhook', async () => {
      const updated = createWebhook({ url: 'https://new.example.com/hook', isActive: false });
      mockWebhookService.updateWebhook.mockResolvedValue(updated);

      const res = await app.request('/integrations/webhooks/webhook-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://new.example.com/hook', isActive: false }),
      });

      expect(res.status).toBe(200);
      const body = await jsonBody(res);
      expect(body.data.url).toBe('https://new.example.com/hook');
      expect(body.data.isActive).toBe(false);
      // Secret must be stripped
      expect(body.data.secret).toBeUndefined();
      expect(mockWebhookService.updateWebhook).toHaveBeenCalledWith(
        'test-org-id',
        'webhook-1',
        { url: 'https://new.example.com/hook', isActive: false }
      );
    });

    it('returns 400 for invalid URL', async () => {
      const res = await app.request('/integrations/webhooks/webhook-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'not-a-url' }),
      });

      expect(res.status).toBe(400);
    });
  });

  // ─── DELETE /integrations/webhooks/:id ────────────────────────────────────
  describe('DELETE /integrations/webhooks/:id', () => {
    it('deletes webhook', async () => {
      mockWebhookService.deleteWebhook.mockResolvedValue(undefined);

      const res = await app.request('/integrations/webhooks/webhook-1', {
        method: 'DELETE',
      });

      expect(res.status).toBe(200);
      const body = await jsonBody(res);
      expect(body.data.deleted).toBe(true);
      expect(mockWebhookService.deleteWebhook).toHaveBeenCalledWith('test-org-id', 'webhook-1');
    });

  });

  // ─── POST /integrations/webhooks/:id/test ─────────────────────────────────
  describe('POST /integrations/webhooks/:id/test', () => {
    it('tests webhook delivery', async () => {
      mockWebhookService.testWebhook.mockResolvedValue({ statusCode: 200, success: true });

      const res = await app.request('/integrations/webhooks/webhook-1/test', {
        method: 'POST',
      });

      expect(res.status).toBe(200);
      const body = await jsonBody(res);
      expect(body.data.statusCode).toBe(200);
      expect(body.data.success).toBe(true);
      expect(mockWebhookService.testWebhook).toHaveBeenCalledWith('test-org-id', 'webhook-1');
    });

    it('returns test result even when webhook returns non-2xx', async () => {
      mockWebhookService.testWebhook.mockResolvedValue({ statusCode: 500, success: false });

      const res = await app.request('/integrations/webhooks/webhook-1/test', {
        method: 'POST',
      });

      expect(res.status).toBe(200);
      const body = await jsonBody(res);
      expect(body.data.success).toBe(false);
      expect(body.data.statusCode).toBe(500);
    });
  });

  // ─── GET /integrations/webhooks/:id/deliveries ────────────────────────────
  describe('GET /integrations/webhooks/:id/deliveries', () => {
    it('returns paginated delivery logs', async () => {
      const logs = [createDeliveryLog(), createDeliveryLog()];
      mockWebhookService.getDeliveryLogs.mockResolvedValue({ data: logs, total: 2 });

      const res = await app.request('/integrations/webhooks/webhook-1/deliveries');
      expect(res.status).toBe(200);
      const body = await jsonBody(res);
      expect(body.data).toHaveLength(2);
      expect(body.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 2,
        totalPages: 1,
      });
      expect(mockWebhookService.getDeliveryLogs).toHaveBeenCalledWith('test-org-id', 'webhook-1', 1, 20);
    });

    it('respects pagination params', async () => {
      mockWebhookService.getDeliveryLogs.mockResolvedValue({ data: [], total: 50 });

      const res = await app.request('/integrations/webhooks/webhook-1/deliveries?page=3&limit=10');
      expect(res.status).toBe(200);
      const body = await jsonBody(res);
      expect(body.pagination.page).toBe(3);
      expect(body.pagination.limit).toBe(10);
      expect(body.pagination.total).toBe(50);
      expect(body.pagination.totalPages).toBe(5);
      expect(mockWebhookService.getDeliveryLogs).toHaveBeenCalledWith('test-org-id', 'webhook-1', 3, 10);
    });

    it('returns 400 for invalid pagination params', async () => {
      const res = await app.request('/integrations/webhooks/webhook-1/deliveries?page=0');
      expect(res.status).toBe(400);
    });

    it('returns 400 when limit exceeds 100', async () => {
      const res = await app.request('/integrations/webhooks/webhook-1/deliveries?limit=200');
      expect(res.status).toBe(400);
    });
  });

  // ─── Auth guard ───────────────────────────────────────────────────────────
  describe('Auth guard', () => {
    it('returns 401 without auth', async () => {
      const { requireAuth } = await import('../../middlewares/auth.js');
      const { HTTP401Error } = await import('../../lib/errors.js');
      vi.mocked(requireAuth).mockImplementationOnce(async (_c: any, _next: any) => {
        throw new HTTP401Error('Unauthorized');
      });

      const res = await app.request('/integrations/webhooks');
      expect(res.status).toBe(401);

      // Restore default mock for subsequent tests
      vi.mocked(requireAuth).mockImplementation(async (c: any, next: any) => {
        c.set('userId', 'test-user-id');
        c.set('orgId', 'test-org-id');
        await next();
      });
    });
  });
});
