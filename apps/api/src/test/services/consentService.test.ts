import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createChain } from '../helpers/mockDb.js';

let selectResult: unknown[] = [];
let insertResult: unknown[] = [];

vi.mock('../../lib/db.js', () => ({
  db: {
    select: vi.fn(() => createChain(selectResult)),
    insert: vi.fn(() => createChain(insertResult)),
  },
  pool: {},
}));

vi.mock('../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { consentService } from '../../services/consentService.js';

describe('consentService', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    selectResult = [];
    insertResult = [];
    const { db } = await import('../../lib/db.js');
    vi.mocked(db.select).mockImplementation(() => createChain(selectResult) as any);
    vi.mocked(db.insert).mockImplementation(() => createChain(insertResult) as any);
  });

  describe('logConsent', () => {
    it('inserts consent record', async () => {
      const { db } = await import('../../lib/db.js');
      await consentService.logConsent({
        userId: 'user-1',
        email: 'User@Test.com',
        consentType: 'terms_and_privacy',
        consentGiven: true,
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
      });
      expect(db.insert).toHaveBeenCalled();
    });

    it('handles optional fields', async () => {
      await consentService.logConsent({
        email: 'user@test.com',
        consentType: 'marketing',
        consentGiven: false,
      });
      const { db } = await import('../../lib/db.js');
      expect(db.insert).toHaveBeenCalled();
    });
  });

  describe('logSignupConsent', () => {
    it('logs terms_and_privacy consent', async () => {
      const { db } = await import('../../lib/db.js');
      await consentService.logSignupConsent({
        userId: 'user-1',
        email: 'user@test.com',
        ipAddress: '127.0.0.1',
        userAgent: 'test',
      });
      expect(db.insert).toHaveBeenCalled();
    });
  });

  describe('getConsentHistory', () => {
    it('returns consent logs for email', async () => {
      selectResult = [
        { id: 'log-1', consentType: 'terms_and_privacy', consentGiven: true },
        { id: 'log-2', consentType: 'marketing', consentGiven: false },
      ];

      const history = await consentService.getConsentHistory('User@Test.com');
      expect(history).toHaveLength(2);
    });

    it('returns empty array when no history', async () => {
      selectResult = [];
      const history = await consentService.getConsentHistory('new@test.com');
      expect(history).toHaveLength(0);
    });
  });

  describe('getCurrentTermsVersion', () => {
    it('returns version string', () => {
      const version = consentService.getCurrentTermsVersion();
      expect(version).toBe('1.0');
    });
  });
});
