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

vi.mock('../../services/stripeService.js', () => ({
  stripeService: {
    isConfigured: vi.fn().mockReturnValue(false),
    cancelSubscription: vi.fn(),
  },
}));

import { orgService, getOrgTier, verifyOrgAdmin } from '../../services/orgService.js';

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

  describe('getOrgTier', () => {
    it('returns org tier from database', async () => {
      selectResult = [{ tier: 'pro' }];
      const tier = await getOrgTier('org-1');
      expect(tier).toBe('pro');
    });

    it('defaults to free when tier is null', async () => {
      selectResult = [{ tier: null }];
      const tier = await getOrgTier('org-1');
      expect(tier).toBe('free');
    });

    it('defaults to free when org not found', async () => {
      selectResult = [];
      const tier = await getOrgTier('nonexistent');
      expect(tier).toBe('free');
    });

    it('defaults to free when tier column missing', async () => {
      const { db } = await import('../../lib/db.js');
      vi.mocked(db.select).mockImplementation(() => {
        throw new Error('column "tier" does not exist');
      });

      const tier = await getOrgTier('org-1');
      expect(tier).toBe('free');
    });

    it('re-throws non-column errors', async () => {
      const { db } = await import('../../lib/db.js');
      vi.mocked(db.select).mockImplementation(() => {
        throw new Error('connection refused');
      });

      await expect(getOrgTier('org-1')).rejects.toThrow('connection refused');
    });
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

  describe('getSubscriptionStatus', () => {
    it('returns subscription status for team tier', async () => {
      let callCount = 0;
      const { db } = await import('../../lib/db.js');
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) return createChain([{ role: 'admin' }]) as any; // membership
        if (callCount === 2) return createChain([{
          tier: 'team',
          tierUpgradedAt: new Date(),
          subscriptionStatus: 'active',
          trialEndsAt: null,
          subscriptionEndsAt: null,
          stripeCustomerId: 'cus_123',
        }]) as any; // org
        // getOrgTier
        return createChain([{ tier: 'team' }]) as any;
      });

      const result = await orgService.getSubscriptionStatus('org-1', 'user-1');
      expect(result.tier).toBe('team');
      expect(result.scanStatus.canScan).toBe(true);
    });

    it('returns free tier with scan blocked after successful scan', async () => {
      let callCount = 0;
      const { db } = await import('../../lib/db.js');
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) return createChain([{ role: 'member' }]) as any; // membership
        if (callCount === 2) return createChain([{
          tier: 'free',
          tierUpgradedAt: null,
          subscriptionStatus: null,
          trialEndsAt: null,
          subscriptionEndsAt: null,
          stripeCustomerId: null,
        }]) as any; // org
        if (callCount === 3) return createChain([{ tier: 'free' }]) as any; // getOrgTier
        // successful scan check
        return createChain([{ id: 'scan-1' }]) as any;
      });

      const result = await orgService.getSubscriptionStatus('org-1', 'user-1');
      expect(result.tier).toBe('free');
      expect(result.scanStatus.canScan).toBe(false);
      expect(result.scanStatus.reason).toContain('Free tier');
    });

    it('throws 403 for non-member', async () => {
      selectResult = [];
      await expect(orgService.getSubscriptionStatus('org-1', 'user-1'))
        .rejects.toThrow('do not have access');
    });

    it('throws 404 when org not found', async () => {
      let callCount = 0;
      const { db } = await import('../../lib/db.js');
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        if (callCount === 1) return createChain([{ role: 'admin' }]) as any;
        return createChain([]) as any; // org not found
      });

      await expect(orgService.getSubscriptionStatus('org-1', 'user-1'))
        .rejects.toThrow('not found');
    });
  });

  describe('upgradeSubscription', () => {
    it('upgrades tier when stripe not configured', async () => {
      let callCount = 0;
      const { db } = await import('../../lib/db.js');
      vi.mocked(db.select).mockImplementation(() => {
        callCount++;
        return createChain([{ role: 'admin' }]) as any;
      });
      updateResult = [{ tier: 'pro' }];

      const result = await orgService.upgradeSubscription('org-1', 'user-1', 'pro');
      expect(result.tier).toBe('pro');
    });

    it('throws 403 for non-admin', async () => {
      selectResult = [{ role: 'member' }];
      await expect(orgService.upgradeSubscription('org-1', 'user-1', 'pro'))
        .rejects.toThrow('Only admins');
    });

    it('throws 403 for non-member', async () => {
      selectResult = [];
      await expect(orgService.upgradeSubscription('org-1', 'user-1', 'pro'))
        .rejects.toThrow('do not have access');
    });

    it('throws 400 for invalid tier', async () => {
      selectResult = [{ role: 'admin' }];
      await expect(orgService.upgradeSubscription('org-1', 'user-1', 'invalid' as any))
        .rejects.toThrow('Invalid tier');
    });
  });
});
