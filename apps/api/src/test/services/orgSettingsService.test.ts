import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createChain } from '../helpers/mockDb.js';

let selectResult: unknown[] = [];
let insertResult: unknown[] = [];
let updateResult: unknown[] = [];

vi.mock('../../lib/db.js', () => ({
  db: {
    select: vi.fn(() => createChain(selectResult)),
    insert: vi.fn(() => createChain(insertResult)),
    update: vi.fn(() => createChain(updateResult)),
  },
  pool: {},
}));

import { orgSettingsService } from '../../services/orgSettingsService.js';

describe('orgSettingsService', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    selectResult = [];
    insertResult = [];
    updateResult = [];
    const { db } = await import('../../lib/db.js');
    vi.mocked(db.select).mockImplementation(() => createChain(selectResult) as any);
    vi.mocked(db.insert).mockImplementation(() => createChain(insertResult) as any);
    vi.mocked(db.update).mockImplementation(() => createChain(updateResult) as any);
  });

  describe('getSettings', () => {
    it('returns existing settings', async () => {
      let callCount = 0;
      const { db } = await import('../../lib/db.js');
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) return createChain([{ role: 'admin' }]) as any; // membership
        return createChain([{ orgId: 'org-1', requiredTags: ['env'], hiddenFindingTypes: [], hideTrivial: false }]) as any;
      });

      const settings = await orgSettingsService.getSettings('org-1', 'user-1');
      expect(settings.requiredTags).toEqual(['env']);
    });

    it('creates default settings when none exist', async () => {
      let callCount = 0;
      const { db } = await import('../../lib/db.js');
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) return createChain([{ role: 'member' }]) as any; // membership
        return createChain([]) as any; // no existing settings
      });
      insertResult = [{ orgId: 'org-1', requiredTags: ['Environment', 'Owner', 'CostCenter'], hiddenFindingTypes: [], hideTrivial: false }];

      const settings = await orgSettingsService.getSettings('org-1', 'user-1');
      expect(settings.requiredTags).toEqual(['Environment', 'Owner', 'CostCenter']);
    });

    it('throws 403 for non-member', async () => {
      selectResult = []; // no membership
      await expect(orgSettingsService.getSettings('org-1', 'user-1'))
        .rejects.toThrow('do not have access');
    });
  });

  describe('updateSettings', () => {
    it('updates existing settings', async () => {
      let callCount = 0;
      const { db } = await import('../../lib/db.js');
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) return createChain([{ role: 'admin' }]) as any;
        return createChain([{ orgId: 'org-1' }]) as any; // existing settings
      });
      updateResult = [{ orgId: 'org-1', requiredTags: ['Name'], hiddenFindingTypes: [], hideTrivial: true }];

      const settings = await orgSettingsService.updateSettings('org-1', 'user-1', {
        requiredTags: ['Name'],
        hideTrivial: true,
      });
      expect(settings.hideTrivial).toBe(true);
    });

    it('creates settings when updating non-existent', async () => {
      let callCount = 0;
      const { db } = await import('../../lib/db.js');
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) return createChain([{ role: 'admin' }]) as any;
        return createChain([]) as any; // no existing settings
      });
      insertResult = [{ orgId: 'org-1', requiredTags: ['Tag1'], hiddenFindingTypes: [], hideTrivial: false }];

      const settings = await orgSettingsService.updateSettings('org-1', 'user-1', {
        requiredTags: ['Tag1'],
      });
      expect(settings.requiredTags).toEqual(['Tag1']);
    });

    it('throws 403 for non-admin', async () => {
      selectResult = [{ role: 'member' }];
      await expect(orgSettingsService.updateSettings('org-1', 'user-1', { hideTrivial: true }))
        .rejects.toThrow('Only admins');
    });

    it('throws 403 for non-member', async () => {
      selectResult = [];
      await expect(orgSettingsService.updateSettings('org-1', 'user-1', {}))
        .rejects.toThrow('do not have access');
    });
  });
});
