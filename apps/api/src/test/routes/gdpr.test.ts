import { describe, it, expect, vi, beforeEach } from 'vitest';
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

vi.mock('../../services/listmonkService.js', () => ({
  listmonkService: {
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
      const body = await res.json();
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
      const body = await res.json();
      expect(body.requestId).toBe('req-1');
      expect(body.gracePeriodDays).toBe(30);
    });
  });

  describe('GET /gdpr/restriction', () => {
    it('returns restriction status', async () => {
      dbSelectResult = [{ processingRestricted: false, processingRestrictedAt: null }];

      const res = await app.request('/gdpr/restriction');
      expect(res.status).toBe(200);
      const body = await res.json();
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
      const body = await res.json();
      expect(body.restricted).toBe(true);
    });
  });

  describe('GET /gdpr/profile', () => {
    it('returns user profile', async () => {
      const user = createUser({ id: 'test-user-id' });
      dbSelectResult = [user];

      const res = await app.request('/gdpr/profile');
      expect(res.status).toBe(200);
      const body = await res.json();
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
      const body = await res.json();
      expect(body.requests).toBeDefined();
    });
  });
});
