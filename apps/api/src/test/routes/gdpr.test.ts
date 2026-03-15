import { describe, it, expect, vi, beforeEach } from 'vitest';
import { jsonBody } from '../setup.js';
import { Hono } from 'hono';
import type { Variables } from '../../types/index.js';
import { createChain } from '../helpers/mockDb.js';
import { createUser } from '../helpers/factories.js';

let dbSelectResult: unknown[] = [];
let dbInsertResult: unknown[] = [];
let dbUpdateResult: unknown[] = [];

vi.mock('../../lib/db.js', () => ({
  db: {
    select: vi.fn(() => createChain(dbSelectResult)),
    insert: vi.fn(() => createChain(dbInsertResult)),
    update: vi.fn(() => createChain(dbUpdateResult)),
  },
  pool: {},
}));

vi.mock('../../middlewares/auth.js', () => ({
  requireAuth: vi.fn(async (c: any, next: any) => {
    c.set('userId', 'test-user-id');
    c.set('orgId', 'test-org-id');
    await next();
  }),
}));

vi.mock('../../middlewares/auditLog.js', () => ({
  auditLog: vi.fn(async (_c: any, next: any) => { await next(); }),
  logDataAccess: vi.fn().mockResolvedValue(undefined),
  logAuthEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/consentService.js', () => ({
  consentService: {
    logConsent: vi.fn().mockResolvedValue(undefined),
    getConsentHistory: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../services/subscriberService.js', () => ({
  subscriberService: {
    subscribe: vi.fn().mockResolvedValue(undefined),
    unsubscribe: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../lib/ip.js', () => ({
  getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
}));

vi.mock('../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../lib/metrics.js', () => ({
  errorsTotal: { inc: vi.fn() },
}));

import gdprRoute from '../../routes/gdpr.js';
import { errorHandler } from '../../middlewares/errorHandler.js';

describe('GDPR Routes', () => {
  let app: Hono<{ Variables: Variables }>;

  beforeEach(async () => {
    app = new Hono<{ Variables: Variables }>();
    app.route('/gdpr', gdprRoute);
    app.onError(errorHandler);
    vi.clearAllMocks();
    dbSelectResult = [];
    dbInsertResult = [];
    dbUpdateResult = [];
    // Restore default mock implementations (mockImplementation persists through clearAllMocks)
    const { db } = await import('../../lib/db.js');
    vi.mocked(db.select).mockImplementation(() => createChain(dbSelectResult) as any);
    vi.mocked(db.insert).mockImplementation(() => createChain(dbInsertResult) as any);
    vi.mocked(db.update).mockImplementation(() => createChain(dbUpdateResult) as any);
  });

  describe('GET /gdpr/export', () => {
    it('exports user data', async () => {
      const user = createUser({ id: 'test-user-id' });
      // Multiple selects are called - user, memberships, consents, audit logs, billing, oauth, marketing
      dbSelectResult = [user];

      const res = await app.request('/gdpr/export');
      expect(res.status).toBe(200);
      const body = await jsonBody(res);
      expect(body.personalData).toBeDefined();
      expect(body.gdprInfo).toBeDefined();
    });

    it('returns 404 when user not found', async () => {
      dbSelectResult = [];

      const res = await app.request('/gdpr/export');
      expect(res.status).toBe(404);
    });
  });

  describe('POST /gdpr/delete', () => {
    it('creates deletion request', async () => {
      const user = createUser({ id: 'test-user-id' });
      // First select: user, second select: existing requests
      let selectCalls = 0;
      const { db } = await import('../../lib/db.js');
      vi.mocked(db.select).mockImplementation(() => {
        selectCalls++;
        if (selectCalls === 1) return createChain([user]) as any;
        return createChain([]) as any; // No existing requests
      });

      const request = { id: 'req-1', scheduledDeletionAt: new Date() };
      vi.mocked(db.insert).mockReturnValue(createChain([request]) as any);

      const res = await app.request('/gdpr/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(201);
      const body = await jsonBody(res);
      expect(body.requestId).toBe('req-1');
      expect(body.gracePeriodDays).toBe(30);
    });
  });

  describe('GET /gdpr/restriction', () => {
    it('returns restriction status', async () => {
      dbSelectResult = [{ processingRestricted: false, processingRestrictedAt: null }];

      const res = await app.request('/gdpr/restriction');
      expect(res.status).toBe(200);
      const body = await jsonBody(res);
      expect(body.restricted).toBe(false);
    });
  });

  describe('PUT /gdpr/restriction', () => {
    it('enables processing restriction', async () => {
      const user = createUser({ id: 'test-user-id' });
      dbSelectResult = [user];
      dbUpdateResult = [{ processingRestricted: true, processingRestrictedAt: new Date().toISOString() }];

      const res = await app.request('/gdpr/restriction', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restricted: true }),
      });
      expect(res.status).toBe(200);
      const body = await jsonBody(res);
      expect(body.restricted).toBe(true);
    });
  });

  describe('GET /gdpr/profile', () => {
    it('returns user profile', async () => {
      const user = createUser({ id: 'test-user-id' });
      dbSelectResult = [user];

      const res = await app.request('/gdpr/profile');
      expect(res.status).toBe(200);
      const body = await jsonBody(res);
      expect(body.email).toBe(user.email);
      expect(body.fullName).toBe(user.fullName);
    });

    it('returns 404 when user not found', async () => {
      dbSelectResult = [];

      const res = await app.request('/gdpr/profile');
      expect(res.status).toBe(404);
    });
  });

  describe('GET /gdpr/deletion-status', () => {
    it('returns deletion requests', async () => {
      dbSelectResult = [];

      const res = await app.request('/gdpr/deletion-status');
      expect(res.status).toBe(200);
      const body = await jsonBody(res);
      expect(body.requests).toBeDefined();
    });
  });

  describe('GET /gdpr/objection', () => {
    it('returns objection status when no objection exists', async () => {
      const user = createUser({ id: 'test-user-id' });
      let selectCalls = 0;
      const { db } = await import('../../lib/db.js');
      vi.mocked(db.select).mockImplementation(() => {
        selectCalls++;
        if (selectCalls === 1) return createChain([user]) as any;
        return createChain([]) as any; // No objection records
      });

      const res = await app.request('/gdpr/objection');
      expect(res.status).toBe(200);
      const body = await jsonBody(res);
      expect(body.objectionActive).toBe(false);
      expect(body.lastUpdated).toBeNull();
    });

    it('returns active objection when one exists', async () => {
      const user = createUser({ id: 'test-user-id' });
      const objection = {
        consentGiven: false,
        consentedAt: new Date().toISOString(),
        metadata: { reason: 'Privacy concerns', processingActivity: 'analytics' },
      };
      let selectCalls = 0;
      const { db } = await import('../../lib/db.js');
      vi.mocked(db.select).mockImplementation(() => {
        selectCalls++;
        if (selectCalls === 1) return createChain([user]) as any;
        return createChain([objection]) as any;
      });

      const res = await app.request('/gdpr/objection');
      expect(res.status).toBe(200);
      const body = await jsonBody(res);
      expect(body.objectionActive).toBe(true);
      expect(body.reason).toBe('Privacy concerns');
    });

    it('returns 404 when user not found', async () => {
      dbSelectResult = [];

      const res = await app.request('/gdpr/objection');
      expect(res.status).toBe(404);
    });
  });

  describe('POST /gdpr/objection', () => {
    it('creates an objection', async () => {
      const user = createUser({ id: 'test-user-id' });
      dbSelectResult = [user];

      const res = await app.request('/gdpr/objection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          processingActivity: 'analytics',
          reason: 'I do not want analytics tracking',
        }),
      });
      expect(res.status).toBe(201);
      const body = await jsonBody(res);
      expect(body.message).toBe('Objection recorded');
      expect(body.processingActivity).toBe('analytics');
    });

    it('unsubscribes from marketing when objecting to marketing', async () => {
      const user = createUser({ id: 'test-user-id' });
      dbSelectResult = [user];

      const { subscriberService } = await import('../../services/subscriberService.js');

      const res = await app.request('/gdpr/objection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          processingActivity: 'marketing',
          reason: 'No marketing emails',
        }),
      });
      expect(res.status).toBe(201);
      expect(subscriberService.unsubscribe).toHaveBeenCalledWith(user.email);
    });

    it('returns 404 when user not found', async () => {
      dbSelectResult = [];

      const res = await app.request('/gdpr/objection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          processingActivity: 'analytics',
          reason: 'Privacy concerns',
        }),
      });
      expect(res.status).toBe(404);
    });

    it('validates required fields', async () => {
      const res = await app.request('/gdpr/objection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
    });

    it('validates processing activity enum', async () => {
      const res = await app.request('/gdpr/objection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          processingActivity: 'invalid',
          reason: 'test',
        }),
      });
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /gdpr/objection', () => {
    it('withdraws an objection', async () => {
      const user = createUser({ id: 'test-user-id' });
      dbSelectResult = [user];

      const res = await app.request('/gdpr/objection', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ processingActivity: 'analytics' }),
      });
      expect(res.status).toBe(200);
      const body = await jsonBody(res);
      expect(body.message).toBe('Objection withdrawn');
    });

    it('returns 404 when user not found', async () => {
      dbSelectResult = [];

      const res = await app.request('/gdpr/objection', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ processingActivity: 'analytics' }),
      });
      expect(res.status).toBe(404);
    });
  });
});
