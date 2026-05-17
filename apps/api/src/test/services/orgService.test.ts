import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createChain } from '../helpers/mockDb.js';

let selectResult: unknown[] = [];
let insertResult: unknown[] = [];
let updateResult: unknown[] = [];
const mockTransaction = vi.fn();

vi.mock('../../lib/db.js', () => ({
  db: {
    select: vi.fn(() => createChain(selectResult)),
    insert: vi.fn(() => createChain(insertResult)),
    update: vi.fn(() => createChain(updateResult)),
    transaction: (...args: unknown[]) => mockTransaction(...args),
    selectDistinct: vi.fn(() => createChain([])),
  },
  pool: {},
}));

vi.mock('../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../lib/metrics.js', () => ({
  orgsCreatedTotal: { inc: vi.fn() },
}));

import { orgService, verifyOrgAdmin } from '../../services/orgService.js';

describe('orgService', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    selectResult = [];
    insertResult = [];
    updateResult = [];
    // Restore default mock implementations
    const { db } = await import('../../lib/db.js');
    vi.mocked(db.select).mockImplementation(() => createChain(selectResult) as any);
    vi.mocked(db.insert).mockImplementation(() => createChain(insertResult) as any);
    vi.mocked(db.update).mockImplementation(() => createChain(updateResult) as any);
  });

  describe('verifyOrgAdmin', () => {
    it('passes for admin users', async () => {
      selectResult = [{ role: 'admin' }];
      await expect(verifyOrgAdmin('org-1', 'user-1')).resolves.toBeUndefined();
    });

    it('throws 403 for non-members', async () => {
      selectResult = [];
      await expect(verifyOrgAdmin('org-1', 'user-1')).rejects.toThrow('You do not have access');
    });

    it('throws 403 for non-admin members', async () => {
      selectResult = [{ role: 'member' }];
      await expect(verifyOrgAdmin('org-1', 'user-1')).rejects.toThrow('Only admins');
    });
  });

  describe('createOrg', () => {
    it('creates org and adds user as admin', async () => {
      const createdOrg = { id: 'org-new', name: 'Test Org', slug: 'test-org-abc' };

      mockTransaction.mockImplementation(async (fn: any) => {
        const tx = {
          insert: vi.fn(() => createChain([createdOrg])),
          update: vi.fn(() => createChain([])),
        };
        return fn(tx);
      });

      const result = await orgService.createOrg('user-1', 'Test Org', 'John Doe', 'CEO');
      expect(result.org).toEqual(createdOrg);
      expect(mockTransaction).toHaveBeenCalled();
    });
  });

  describe('getOrg', () => {
    it('returns org when user has access', async () => {
      let callCount = 0;
      const { db } = await import('../../lib/db.js');
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) return createChain([{ role: 'admin' }]) as any; // membership check
        return createChain([{ id: 'org-1', name: 'Test' }]) as any; // org fetch
      });

      const org = await orgService.getOrg('org-1', 'user-1');
      expect(org.name).toBe('Test');
    });

    it('throws 403 when user has no access', async () => {
      selectResult = [];
      await expect(orgService.getOrg('org-1', 'user-1')).rejects.toThrow('You do not have access');
    });

    it('throws 404 when org not found', async () => {
      let callCount = 0;
      const { db } = await import('../../lib/db.js');
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) return createChain([{ role: 'admin' }]) as any;
        return createChain([]) as any; // org not found
      });

      await expect(orgService.getOrg('org-1', 'user-1')).rejects.toThrow('Organization not found');
    });
  });

  describe('updateOrg', () => {
    it('updates org when user is admin', async () => {
      const updated = { id: 'org-1', name: 'Updated' };
      let callCount = 0;
      const { db } = await import('../../lib/db.js');
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        return createChain([{ role: 'admin' }]) as any;
      });
      vi.mocked(db.update).mockImplementation(() => createChain([updated]) as any);

      const result = await orgService.updateOrg('org-1', 'user-1', { name: 'Updated' });
      expect(result.name).toBe('Updated');
    });

    it('throws 403 for non-admin members', async () => {
      selectResult = [{ role: 'member' }];
      await expect(orgService.updateOrg('org-1', 'user-1', { name: 'X' }))
        .rejects.toThrow('Only admins');
    });
  });

  describe('getUserOrgs', () => {
    it('returns user organizations', async () => {
      selectResult = [
        { id: 'org-1', name: 'Org One', slug: 'org-one', role: 'admin' },
      ];
      const orgs = await orgService.getUserOrgs('user-1');
      expect(orgs).toHaveLength(1);
    });
  });

  describe('getOrgMembers', () => {
    it('throws 403 for non-members', async () => {
      selectResult = [];
      await expect(orgService.getOrgMembers('org-1', 'user-1'))
        .rejects.toThrow('You do not have access');
    });
  });

  describe('getOrgAdminEmail', () => {
    it('returns admin email', async () => {
      selectResult = [{ email: 'admin@test.com', fullName: 'Admin' }];
      const result = await orgService.getOrgAdminEmail('org-1');
      expect(result).toEqual({ email: 'admin@test.com', name: 'Admin' });
    });

    it('returns null when no admin found', async () => {
      selectResult = [];
      const result = await orgService.getOrgAdminEmail('org-1');
      expect(result).toBeNull();
    });
  });

});
