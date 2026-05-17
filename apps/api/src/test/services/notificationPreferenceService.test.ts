import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createChain } from '../helpers/mockDb.js';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

let selectResult: unknown[] = [];
let insertResult: unknown[] = [];

vi.mock('../../lib/db.js', () => ({
  db: {
    select: vi.fn(() => createChain(selectResult)),
    insert: vi.fn(() => createChain(insertResult)),
  },
}));

vi.mock('../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Subject under test — import AFTER mocks
// ---------------------------------------------------------------------------
import { notificationPreferenceService } from '../../services/notificationPreferenceService.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makePreference = (overrides: Record<string, unknown> = {}) => ({
  id: 'pref-1',
  userId: 'user-1',
  orgId: 'org-1',
  digestFrequency: 'weekly',
  timezone: 'UTC',
  notifyScanComplete: true,
  notifyCriticalFindings: true,
  notifyHighFindings: true,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  ...overrides,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('notificationPreferenceService', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    selectResult = [];
    insertResult = [];

    const { db } = await import('../../lib/db.js');
    vi.mocked(db.select).mockImplementation(() => createChain(selectResult) as any);
    vi.mocked(db.insert).mockImplementation(() => createChain(insertResult) as any);
  });

  // -------------------------------------------------------------------------
  // getPreferences
  // -------------------------------------------------------------------------

  describe('getPreferences', () => {
    it('returns existing preferences when they exist', async () => {
      const pref = makePreference({ digestFrequency: 'daily', timezone: 'America/New_York' });
      selectResult = [pref];

      const result = await notificationPreferenceService.getPreferences('user-1', 'org-1');

      expect(result).toEqual(pref);
    });

    it('returns defaults when no preferences exist', async () => {
      selectResult = [];

      const result = await notificationPreferenceService.getPreferences('user-1', 'org-1');

      expect(result).toEqual({
        digestFrequency: 'weekly',
        timezone: 'UTC',
        notifyScanComplete: true,
        notifyCriticalFindings: true,
        notifyHighFindings: true,
        userId: 'user-1',
        orgId: 'org-1',
      });
    });
  });

  // -------------------------------------------------------------------------
  // updatePreferences
  // -------------------------------------------------------------------------

  describe('updatePreferences', () => {
    it('creates new preferences (upsert)', async () => {
      const pref = makePreference({ digestFrequency: 'daily' });
      insertResult = [pref];

      const result = await notificationPreferenceService.updatePreferences('user-1', 'org-1', {
        digestFrequency: 'daily',
      });

      expect(result).toEqual(pref);
      const { db } = await import('../../lib/db.js');
      expect(db.insert).toHaveBeenCalledOnce();
    });

    it('updates existing preferences', async () => {
      const updated = makePreference({
        digestFrequency: 'off',
        notifyHighFindings: false,
        updatedAt: new Date('2024-06-01'),
      });
      insertResult = [updated];

      const result = await notificationPreferenceService.updatePreferences('user-1', 'org-1', {
        digestFrequency: 'off',
        notifyHighFindings: false,
      });

      expect(result).toEqual(updated);
      expect(result.digestFrequency).toBe('off');
      expect(result.notifyHighFindings).toBe(false);
    });
  });
});
