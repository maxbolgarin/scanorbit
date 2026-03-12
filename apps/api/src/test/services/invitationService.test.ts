import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createChain } from '../helpers/mockDb.js';
import { createOrg, createOrgMember, createOrgInvitation, createUser } from '../helpers/factories.js';

// --- Mocks ---

const { mockVerifyOrgAdmin, mockGetOrgTier } = vi.hoisted(() => ({
  mockVerifyOrgAdmin: vi.fn().mockResolvedValue(undefined),
  mockGetOrgTier: vi.fn().mockResolvedValue('team'),
}));

vi.mock('../../services/orgService.js', () => ({
  verifyOrgAdmin: mockVerifyOrgAdmin,
  getOrgTier: mockGetOrgTier,
}));

const { mockStripeService } = vi.hoisted(() => ({
  mockStripeService: {
    getSeatBillingPreview: vi.fn().mockReturnValue({
      willAddPaidSeat: false,
      currentPaidSeats: 0,
      newPaidSeats: 0,
      seatPriceMonthly: 10,
      estimatedNewMonthly: 0,
    }),
    updateSeatQuantity: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../services/stripeService.js', () => ({
  stripeService: mockStripeService,
}));

const { mockEmailService } = vi.hoisted(() => ({
  mockEmailService: {
    sendInvitationEmail: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../services/emailService.js', () => ({
  emailService: mockEmailService,
}));

vi.mock('../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// DB mock with transaction support
let selectCallResults: unknown[][] = [];
let selectCallIndex = 0;
let insertResult: unknown[] = [];
let updateResult: unknown[] = [];
let deleteResult: unknown[] = [];

vi.mock('../../lib/db.js', () => ({
  db: {
    select: vi.fn(() => createChain([])),
    insert: vi.fn(() => createChain([])),
    update: vi.fn(() => createChain([])),
    delete: vi.fn(() => createChain([])),
    transaction: vi.fn(async (fn: (tx: any) => Promise<unknown>) => {
      const tx = {
        select: vi.fn(() => createChain([])),
        insert: vi.fn(() => createChain([])),
        update: vi.fn(() => createChain([])),
        delete: vi.fn(() => createChain([])),
      };
      return fn(tx);
    }),
  },
  pool: {},
}));

import { invitationService } from '../../services/invitationService.js';

// Helper to configure sequential select results
function setupSelectSequence(results: unknown[][]) {
  selectCallResults = results;
  selectCallIndex = 0;
}

describe('invitationService', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    selectCallResults = [];
    selectCallIndex = 0;
    insertResult = [];
    updateResult = [];
    deleteResult = [];

    mockVerifyOrgAdmin.mockResolvedValue(undefined);
    mockGetOrgTier.mockResolvedValue('team');
    mockStripeService.getSeatBillingPreview.mockReturnValue({
      willAddPaidSeat: false,
      currentPaidSeats: 0,
      newPaidSeats: 0,
      seatPriceMonthly: 10,
      estimatedNewMonthly: 0,
    });
    mockStripeService.updateSeatQuantity.mockResolvedValue(undefined);
    mockEmailService.sendInvitationEmail.mockResolvedValue(undefined);

    const { db } = await import('../../lib/db.js');
    vi.mocked(db.select).mockImplementation(() => {
      const result = selectCallResults[selectCallIndex] ?? [];
      selectCallIndex++;
      return createChain(result) as any;
    });
    vi.mocked(db.insert).mockImplementation(() => createChain(insertResult) as any);
    vi.mocked(db.update).mockImplementation(() => createChain(updateResult) as any);
    vi.mocked(db.delete).mockImplementation(() => createChain(deleteResult) as any);
  });

  // ------- createInvitation -------
  describe('createInvitation', () => {
    it('creates invitation successfully', async () => {
      const invitation = createOrgInvitation({ orgId: 'org-1', email: 'new@test.com' });

      // 1: check existing user by email → no user found
      // 2: check existing pending invitation → none
      // 3: member count for billing → 2
      // 4: inviter name
      // 5: org name
      setupSelectSequence([
        [],                                    // no existing user
        [],                                    // no pending invite
        [{ count: 2 }],                        // member count
        [{ fullName: 'Admin User' }],          // inviter
        [{ name: 'Test Org' }],                // org
      ]);

      insertResult = [invitation];

      const result = await invitationService.createInvitation('org-1', 'admin-1', '  New@Test.com  ', 'member');

      expect(mockVerifyOrgAdmin).toHaveBeenCalledWith('org-1', 'admin-1');
      expect(mockGetOrgTier).toHaveBeenCalledWith('org-1');
      expect(result.invitation).toBeDefined();
      expect(result.billing).toBeDefined();
      expect(mockEmailService.sendInvitationEmail).toHaveBeenCalledWith(
        'new@test.com', 'Admin User', 'Test Org', expect.any(String)
      );
    });

    it('throws 403 when tier does not allow invites', async () => {
      mockGetOrgTier.mockResolvedValue('free');

      await expect(
        invitationService.createInvitation('org-1', 'admin-1', 'test@test.com', 'member')
      ).rejects.toThrow('Team plan only');
    });

    it('throws 403 on pro tier', async () => {
      mockGetOrgTier.mockResolvedValue('pro');

      await expect(
        invitationService.createInvitation('org-1', 'admin-1', 'test@test.com', 'member')
      ).rejects.toThrow('Team plan only');
    });

    it('throws 409 when user is already a member', async () => {
      setupSelectSequence([
        [{ id: 'user-123' }],                 // existing user found
        [{ id: 'member-1' }],                 // existing membership found
      ]);

      await expect(
        invitationService.createInvitation('org-1', 'admin-1', 'existing@test.com', 'member')
      ).rejects.toThrow('already a member');
    });

    it('throws 409 when pending invitation exists', async () => {
      setupSelectSequence([
        [],                                    // no existing user
        [{ id: 'inv-1' }],                    // pending invite exists
      ]);

      await expect(
        invitationService.createInvitation('org-1', 'admin-1', 'test@test.com', 'member')
      ).rejects.toThrow('already pending');
    });

    it('catches PG 23505 race condition and throws 409', async () => {
      setupSelectSequence([
        [],                                    // no existing user
        [],                                    // no pending invite
      ]);

      const { db } = await import('../../lib/db.js');
      vi.mocked(db.insert).mockImplementation(() => {
        const err = new Error('unique violation') as any;
        err.code = '23505';
        throw err;
      });

      await expect(
        invitationService.createInvitation('org-1', 'admin-1', 'test@test.com', 'member')
      ).rejects.toThrow('already pending');
    });

    it('normalizes email to lowercase', async () => {
      const invitation = createOrgInvitation({ email: 'test@example.com' });

      setupSelectSequence([
        [],                                    // no user
        [],                                    // no pending invite
        [{ count: 1 }],                        // member count
        [{ fullName: 'Admin' }],               // inviter
        [{ name: 'Org' }],                     // org
      ]);
      insertResult = [invitation];

      await invitationService.createInvitation('org-1', 'admin-1', '  TEST@EXAMPLE.COM  ', 'member');

      expect(mockEmailService.sendInvitationEmail).toHaveBeenCalledWith(
        'test@example.com', expect.any(String), expect.any(String), expect.any(String)
      );
    });

    it('returns billing preview showing paid seat info', async () => {
      const invitation = createOrgInvitation();
      mockStripeService.getSeatBillingPreview.mockReturnValue({
        willAddPaidSeat: true,
        currentPaidSeats: 1,
        newPaidSeats: 2,
        seatPriceMonthly: 10,
        estimatedNewMonthly: 20,
      });

      setupSelectSequence([
        [],
        [],
        [{ count: 6 }],
        [{ fullName: 'Admin' }],
        [{ name: 'Org' }],
      ]);
      insertResult = [invitation];

      const result = await invitationService.createInvitation('org-1', 'admin-1', 'a@b.com', 'member');
      expect(result.billing.willAddPaidSeat).toBe(true);
      expect(result.billing.estimatedNewMonthly).toBe(20);
    });
  });

  // ------- acceptInvitation -------
  describe('acceptInvitation', () => {
    it('accepts invitation and creates membership', async () => {
      const org = createOrg({ id: 'org-1' });
      const invitation = createOrgInvitation({
        orgId: 'org-1',
        email: 'user@test.com',
        role: 'member',
        token: 'valid-token',
        expiresAt: new Date(Date.now() + 86400000), // +1 day
      });

      // 1: find invitation by token
      // 2: find user by id
      // 3: check existing membership → none
      // 4: member count after insert (Stripe)
      // 5: get org for return
      setupSelectSequence([
        [invitation],
        [{ email: 'user@test.com' }],
        [],
        [{ count: 3 }],
        [org],
      ]);

      const result = await invitationService.acceptInvitation('valid-token', 'user-1');

      expect(result.org).toBeDefined();
      expect(result.org.id).toBe('org-1');
      expect(mockStripeService.updateSeatQuantity).toHaveBeenCalledWith('org-1', 0); // 3 members, 5 included
    });

    it('throws 404 when invitation not found', async () => {
      setupSelectSequence([[]]);

      await expect(
        invitationService.acceptInvitation('bad-token', 'user-1')
      ).rejects.toThrow('Invalid or expired');
    });

    it('throws 400 and marks expired when token is expired', async () => {
      const invitation = createOrgInvitation({
        expiresAt: new Date(Date.now() - 86400000), // -1 day
      });

      setupSelectSequence([[invitation]]);

      await expect(
        invitationService.acceptInvitation('expired-token', 'user-1')
      ).rejects.toThrow('expired');

      const { db } = await import('../../lib/db.js');
      expect(db.update).toHaveBeenCalled();
    });

    it('throws 404 when user not found', async () => {
      const invitation = createOrgInvitation({
        email: 'user@test.com',
        expiresAt: new Date(Date.now() + 86400000),
      });

      setupSelectSequence([
        [invitation],
        [],   // user not found
      ]);

      await expect(
        invitationService.acceptInvitation('token', 'nonexistent-user')
      ).rejects.toThrow('User not found');
    });

    it('throws 403 when email does not match', async () => {
      const invitation = createOrgInvitation({
        email: 'invited@test.com',
        expiresAt: new Date(Date.now() + 86400000),
      });

      setupSelectSequence([
        [invitation],
        [{ email: 'different@test.com' }],
      ]);

      await expect(
        invitationService.acceptInvitation('token', 'user-1')
      ).rejects.toThrow('different email');
    });

    it('handles already-member gracefully', async () => {
      const org = createOrg({ id: 'org-1' });
      const invitation = createOrgInvitation({
        orgId: 'org-1',
        email: 'user@test.com',
        expiresAt: new Date(Date.now() + 86400000),
      });

      setupSelectSequence([
        [invitation],
        [{ email: 'user@test.com' }],
        [{ id: 'member-1' }],   // already a member
        [org],                    // org for return
      ]);

      const result = await invitationService.acceptInvitation('token', 'user-1');

      expect(result.org.id).toBe('org-1');
      // Should NOT update Stripe (member already existed)
      expect(mockStripeService.updateSeatQuantity).not.toHaveBeenCalled();
    });

    it('calculates paid seats correctly for 6+ members', async () => {
      const org = createOrg({ id: 'org-1' });
      const invitation = createOrgInvitation({
        orgId: 'org-1',
        email: 'user@test.com',
        expiresAt: new Date(Date.now() + 86400000),
      });

      setupSelectSequence([
        [invitation],
        [{ email: 'user@test.com' }],
        [],                       // not a member
        [{ count: 7 }],          // 7 members after insert
        [org],
      ]);

      await invitationService.acceptInvitation('token', 'user-1');

      // 7 members - 5 included = 2 paid seats
      expect(mockStripeService.updateSeatQuantity).toHaveBeenCalledWith('org-1', 2);
    });

    it('email comparison is case-insensitive', async () => {
      const org = createOrg({ id: 'org-1' });
      const invitation = createOrgInvitation({
        orgId: 'org-1',
        email: 'USER@Test.com',
        expiresAt: new Date(Date.now() + 86400000),
      });

      setupSelectSequence([
        [invitation],
        [{ email: 'user@test.com' }],   // lowercase
        [],
        [{ count: 1 }],
        [org],
      ]);

      // Should not throw
      const result = await invitationService.acceptInvitation('token', 'user-1');
      expect(result.org).toBeDefined();
    });
  });

  // ------- cancelInvitation -------
  describe('cancelInvitation', () => {
    it('cancels pending invitation', async () => {
      setupSelectSequence([
        [{ id: 'inv-1', status: 'pending' }],
      ]);

      await invitationService.cancelInvitation('org-1', 'admin-1', 'inv-1');

      expect(mockVerifyOrgAdmin).toHaveBeenCalledWith('org-1', 'admin-1');
      const { db } = await import('../../lib/db.js');
      expect(db.update).toHaveBeenCalled();
    });

    it('throws 404 when invitation not found', async () => {
      setupSelectSequence([[]]);

      await expect(
        invitationService.cancelInvitation('org-1', 'admin-1', 'inv-999')
      ).rejects.toThrow('not found');
    });

    it('throws 400 for non-pending invitation', async () => {
      setupSelectSequence([
        [{ id: 'inv-1', status: 'accepted' }],
      ]);

      await expect(
        invitationService.cancelInvitation('org-1', 'admin-1', 'inv-1')
      ).rejects.toThrow('pending');
    });
  });

  // ------- listInvitations -------
  describe('listInvitations', () => {
    it('returns pending invitations with inviter names', async () => {
      const inv1 = createOrgInvitation({ email: 'a@test.com', inviterName: 'Admin' });
      const inv2 = createOrgInvitation({ email: 'b@test.com', inviterName: 'Admin' });

      setupSelectSequence([[inv1, inv2]]);

      const result = await invitationService.listInvitations('org-1', 'admin-1');

      expect(mockVerifyOrgAdmin).toHaveBeenCalledWith('org-1', 'admin-1');
      expect(result).toHaveLength(2);
    });

    it('returns empty array when no invitations', async () => {
      setupSelectSequence([[]]);

      const result = await invitationService.listInvitations('org-1', 'admin-1');
      expect(result).toHaveLength(0);
    });
  });

  // ------- resendInvitation -------
  describe('resendInvitation', () => {
    it('extends expiry and resends email', async () => {
      const invitation = createOrgInvitation({
        id: 'inv-1',
        email: 'test@test.com',
        status: 'pending',
        token: 'tok-1',
        expiresAt: new Date(Date.now() + 86400000),
      });

      // 1: find invitation
      // 2: inviter name (after update)
      // 3: org name (after update)
      setupSelectSequence([
        [invitation],
        [{ fullName: 'Admin' }],
        [{ name: 'Test Org' }],
      ]);

      await invitationService.resendInvitation('org-1', 'admin-1', 'inv-1');

      expect(mockVerifyOrgAdmin).toHaveBeenCalledWith('org-1', 'admin-1');
      const { db } = await import('../../lib/db.js');
      expect(db.update).toHaveBeenCalled();
      expect(mockEmailService.sendInvitationEmail).toHaveBeenCalledWith(
        'test@test.com', 'Admin', 'Test Org', 'tok-1'
      );
    });

    it('throws 404 when invitation not found', async () => {
      setupSelectSequence([[]]);

      await expect(
        invitationService.resendInvitation('org-1', 'admin-1', 'inv-999')
      ).rejects.toThrow('not found');
    });

    it('throws 400 for non-pending invitation', async () => {
      setupSelectSequence([
        [{ ...createOrgInvitation(), status: 'accepted' }],
      ]);

      await expect(
        invitationService.resendInvitation('org-1', 'admin-1', 'inv-1')
      ).rejects.toThrow('pending');
    });

    it('throws 400 for expired invitation', async () => {
      setupSelectSequence([
        [{
          ...createOrgInvitation(),
          status: 'pending',
          expiresAt: new Date(Date.now() - 86400000),
        }],
      ]);

      await expect(
        invitationService.resendInvitation('org-1', 'admin-1', 'inv-1')
      ).rejects.toThrow('expired');
    });
  });

  // ------- removeMember -------
  describe('removeMember', () => {
    it('removes non-admin member and updates Stripe', async () => {
      // 1: find member
      // 2: member count after delete (Stripe)
      setupSelectSequence([
        [{ id: 'mem-1', role: 'member' }],
        [{ count: 4 }],
      ]);

      await invitationService.removeMember('org-1', 'admin-1', 'user-2');

      expect(mockVerifyOrgAdmin).toHaveBeenCalledWith('org-1', 'admin-1');
      const { db } = await import('../../lib/db.js');
      expect(db.delete).toHaveBeenCalled();
      expect(mockStripeService.updateSeatQuantity).toHaveBeenCalledWith('org-1', 0); // 4 < 5
    });

    it('removes admin when there are multiple admins', async () => {
      // 1: find member (admin)
      // 2: admin count → 2
      // 3: member count after delete
      setupSelectSequence([
        [{ id: 'mem-1', role: 'admin' }],
        [{ count: 2 }],
        [{ count: 5 }],
      ]);

      await invitationService.removeMember('org-1', 'admin-1', 'admin-2');

      const { db } = await import('../../lib/db.js');
      expect(db.delete).toHaveBeenCalled();
    });

    it('throws 404 when member not found', async () => {
      setupSelectSequence([[]]);

      await expect(
        invitationService.removeMember('org-1', 'admin-1', 'nonexistent')
      ).rejects.toThrow('not found');
    });

    it('throws 400 when removing last admin', async () => {
      // 1: find member (admin)
      // 2: admin count → 1
      setupSelectSequence([
        [{ id: 'mem-1', role: 'admin' }],
        [{ count: 1 }],
      ]);

      await expect(
        invitationService.removeMember('org-1', 'admin-1', 'admin-1')
      ).rejects.toThrow('last admin');
    });

    it('updates Stripe with paid seats when > 5 members remain', async () => {
      setupSelectSequence([
        [{ id: 'mem-1', role: 'member' }],
        [{ count: 6 }],   // 6 members after delete
      ]);

      await invitationService.removeMember('org-1', 'admin-1', 'user-2');

      expect(mockStripeService.updateSeatQuantity).toHaveBeenCalledWith('org-1', 1); // 6 - 5 = 1
    });
  });

  // ------- changeMemberRole -------
  describe('changeMemberRole', () => {
    it('promotes member to admin', async () => {
      setupSelectSequence([
        [{ role: 'member' }],
      ]);

      await invitationService.changeMemberRole('org-1', 'admin-1', 'user-2', 'admin');

      expect(mockVerifyOrgAdmin).toHaveBeenCalledWith('org-1', 'admin-1');
      const { db } = await import('../../lib/db.js');
      expect(db.update).toHaveBeenCalled();
    });

    it('demotes admin when multiple admins exist', async () => {
      // 1: find member (admin)
      // 2: admin count → 2
      setupSelectSequence([
        [{ role: 'admin' }],
        [{ count: 2 }],
      ]);

      await invitationService.changeMemberRole('org-1', 'admin-1', 'admin-2', 'member');

      const { db } = await import('../../lib/db.js');
      expect(db.update).toHaveBeenCalled();
    });

    it('throws 404 when member not found', async () => {
      setupSelectSequence([[]]);

      await expect(
        invitationService.changeMemberRole('org-1', 'admin-1', 'nonexistent', 'admin')
      ).rejects.toThrow('not found');
    });

    it('throws 400 when demoting last admin', async () => {
      setupSelectSequence([
        [{ role: 'admin' }],
        [{ count: 1 }],
      ]);

      await expect(
        invitationService.changeMemberRole('org-1', 'admin-1', 'admin-1', 'member')
      ).rejects.toThrow('last admin');
    });

    it('does not check admin count when promoting', async () => {
      setupSelectSequence([
        [{ role: 'member' }],
      ]);

      // Should succeed without querying admin count
      await invitationService.changeMemberRole('org-1', 'admin-1', 'user-2', 'admin');
    });
  });

  // ------- getSeatInfo -------
  describe('getSeatInfo', () => {
    it('returns correct seat info under included limit', async () => {
      setupSelectSequence([
        [{ count: 3 }],   // members
        [{ count: 1 }],   // pending invitations
      ]);

      const info = await invitationService.getSeatInfo('org-1');

      expect(info).toEqual({
        totalMembers: 3,
        pendingInvitations: 1,
        includedSeats: 5,
        paidSeats: 0,
        seatPriceMonthly: 10,
      });
    });

    it('calculates paid seats when over limit', async () => {
      setupSelectSequence([
        [{ count: 8 }],   // members
        [{ count: 2 }],   // pending
      ]);

      const info = await invitationService.getSeatInfo('org-1');

      expect(info.totalMembers).toBe(8);
      expect(info.paidSeats).toBe(3); // 8 - 5 = 3
      expect(info.seatPriceMonthly).toBe(10);
    });

    it('returns zero paid seats at exactly 5 members', async () => {
      setupSelectSequence([
        [{ count: 5 }],
        [{ count: 0 }],
      ]);

      const info = await invitationService.getSeatInfo('org-1');
      expect(info.paidSeats).toBe(0);
    });
  });

  // ------- getInviteInfo -------
  describe('getInviteInfo', () => {
    it('returns invite info for valid pending invitation', async () => {
      const expiresAt = new Date(Date.now() + 86400000);
      setupSelectSequence([
        [{
          email: 'user@test.com',
          status: 'pending',
          expiresAt,
          orgName: 'Test Org',
          inviterName: 'Admin User',
        }],
      ]);

      const info = await invitationService.getInviteInfo('valid-token');

      expect(info.orgName).toBe('Test Org');
      expect(info.inviterName).toBe('Admin User');
      expect(info.email).toBe('user@test.com');
      expect(info.expiresAt).toBe(expiresAt.toISOString());
    });

    it('throws 404 when token not found', async () => {
      setupSelectSequence([[]]);

      await expect(
        invitationService.getInviteInfo('bad-token')
      ).rejects.toThrow('not found');
    });

    it('throws 400 for non-pending invitation', async () => {
      setupSelectSequence([
        [{
          email: 'user@test.com',
          status: 'accepted',
          expiresAt: new Date(Date.now() + 86400000),
          orgName: 'Org',
          inviterName: 'Admin',
        }],
      ]);

      await expect(
        invitationService.getInviteInfo('token')
      ).rejects.toThrow('no longer valid');
    });

    it('throws 400 for expired invitation', async () => {
      setupSelectSequence([
        [{
          email: 'user@test.com',
          status: 'pending',
          expiresAt: new Date(Date.now() - 86400000),
          orgName: 'Org',
          inviterName: 'Admin',
        }],
      ]);

      await expect(
        invitationService.getInviteInfo('token')
      ).rejects.toThrow('expired');
    });

    it('uses fallback when inviterName is null', async () => {
      setupSelectSequence([
        [{
          email: 'user@test.com',
          status: 'pending',
          expiresAt: new Date(Date.now() + 86400000),
          orgName: 'Org',
          inviterName: null,
        }],
      ]);

      const info = await invitationService.getInviteInfo('token');
      expect(info.inviterName).toBe('A team admin');
    });
  });
});
