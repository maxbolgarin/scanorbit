import crypto from 'node:crypto';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { orgInvitations, userOrgMembers, users, orgs } from '../db/schema.js';
import { verifyOrgAdmin, getOrgTier } from './orgService.js';
import { stripeService } from './stripeService.js';
import { emailService } from './emailService.js';
import { logger } from '../lib/logger.js';
import { HTTP400Error, HTTP403Error, HTTP404Error, HTTP409Error, getPgErrorCode } from '../lib/errors.js';
import { TIER_LIMITS, SEAT_BILLING } from '../types/index.js';

export const invitationService = {
  /**
   * Create an invitation — admin-only, Team-only
   */
  async createInvitation(
    orgId: string,
    adminUserId: string,
    email: string,
    role: 'admin' | 'member'
  ) {
    await verifyOrgAdmin(orgId, adminUserId);

    // Check tier
    const tier = await getOrgTier(orgId);
    if (!TIER_LIMITS[tier].canInviteMembers) {
      throw new HTTP403Error('Team invitations are available on the Team plan only. Upgrade to Team to invite members.');
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if email is already a member
    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (existingUser) {
      const [existingMember] = await db
        .select({ id: userOrgMembers.id })
        .from(userOrgMembers)
        .where(
          and(
            eq(userOrgMembers.userId, existingUser.id),
            eq(userOrgMembers.orgId, orgId)
          )
        )
        .limit(1);

      if (existingMember) {
        throw new HTTP409Error('This user is already a member of this organization');
      }
    }

    // Check for existing pending invitation
    const [existingInvite] = await db
      .select({ id: orgInvitations.id })
      .from(orgInvitations)
      .where(
        and(
          eq(orgInvitations.orgId, orgId),
          eq(orgInvitations.email, normalizedEmail),
          eq(orgInvitations.status, 'pending')
        )
      )
      .limit(1);

    if (existingInvite) {
      throw new HTTP409Error('An invitation is already pending for this email');
    }

    // Generate token and expiry
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Insert invitation (catch unique constraint violation for race conditions)
    let invitation;
    try {
      [invitation] = await db
        .insert(orgInvitations)
        .values({
          orgId,
          email: normalizedEmail,
          role,
          invitedBy: adminUserId,
          token,
          expiresAt,
        })
        .returning();
    } catch (error) {
      if (getPgErrorCode(error) === '23505') {
        throw new HTTP409Error('An invitation is already pending for this email');
      }
      throw error;
    }

    // Get billing preview
    const memberCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(userOrgMembers)
      .where(eq(userOrgMembers.orgId, orgId));
    const totalMembers = memberCount[0]?.count ?? 0;
    const billing = stripeService.getSeatBillingPreview(totalMembers);

    // Send invitation email (fire-and-forget)
    const [inviter] = await db
      .select({ fullName: users.fullName })
      .from(users)
      .where(eq(users.id, adminUserId))
      .limit(1);

    const [org] = await db
      .select({ name: orgs.name })
      .from(orgs)
      .where(eq(orgs.id, orgId))
      .limit(1);

    const inviterName = inviter?.fullName || 'A team admin';
    const orgName = org?.name || 'your organization';

    emailService.sendInvitationEmail(normalizedEmail, inviterName, orgName, token).catch((err) => {
      logger.error('Failed to send invitation email', { error: (err as Error).message, email: normalizedEmail });
    });

    return { invitation, billing };
  },

  /**
   * Accept an invitation — called by the invitee (logged in)
   */
  async acceptInvitation(token: string, userId: string) {
    // Find invitation by token
    const [invitation] = await db
      .select()
      .from(orgInvitations)
      .where(
        and(
          eq(orgInvitations.token, token),
          eq(orgInvitations.status, 'pending')
        )
      )
      .limit(1);

    if (!invitation) {
      throw new HTTP404Error('Invalid or expired invitation');
    }

    // Check expiry
    if (invitation.expiresAt < new Date()) {
      await db
        .update(orgInvitations)
        .set({ status: 'expired' })
        .where(eq(orgInvitations.id, invitation.id));
      throw new HTTP400Error('This invitation has expired');
    }

    // Verify user email matches invitation email
    const [user] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new HTTP404Error('User not found');
    }

    if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      throw new HTTP403Error('This invitation was sent to a different email address');
    }

    // Check if already a member
    const [existingMember] = await db
      .select({ id: userOrgMembers.id })
      .from(userOrgMembers)
      .where(
        and(
          eq(userOrgMembers.userId, userId),
          eq(userOrgMembers.orgId, invitation.orgId)
        )
      )
      .limit(1);

    if (existingMember) {
      // Already a member — mark invitation as accepted and return org
      await db
        .update(orgInvitations)
        .set({ status: 'accepted' })
        .where(eq(orgInvitations.id, invitation.id));

      const [org] = await db
        .select()
        .from(orgs)
        .where(eq(orgs.id, invitation.orgId))
        .limit(1);

      return { org: org! };
    }

    // Insert member + update invitation in transaction
    await db.transaction(async (tx) => {
      await tx.insert(userOrgMembers).values({
        userId,
        orgId: invitation.orgId,
        role: invitation.role,
      });

      await tx
        .update(orgInvitations)
        .set({ status: 'accepted' })
        .where(eq(orgInvitations.id, invitation.id));
    });

    // Update Stripe seat quantity (after transaction, best-effort)
    const memberCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(userOrgMembers)
      .where(eq(userOrgMembers.orgId, invitation.orgId));
    const totalMembers = memberCount[0]?.count ?? 0;
    const paidSeats = Math.max(0, totalMembers - SEAT_BILLING.INCLUDED_SEATS);
    await stripeService.updateSeatQuantity(invitation.orgId, paidSeats);

    // Return org data for token refresh
    const [org] = await db
      .select()
      .from(orgs)
      .where(eq(orgs.id, invitation.orgId))
      .limit(1);

    return { org: org! };
  },

  /**
   * Cancel an invitation — admin-only
   */
  async cancelInvitation(orgId: string, adminUserId: string, invitationId: string) {
    await verifyOrgAdmin(orgId, adminUserId);

    const [invitation] = await db
      .select({ id: orgInvitations.id, status: orgInvitations.status })
      .from(orgInvitations)
      .where(
        and(
          eq(orgInvitations.id, invitationId),
          eq(orgInvitations.orgId, orgId)
        )
      )
      .limit(1);

    if (!invitation) {
      throw new HTTP404Error('Invitation not found');
    }

    if (invitation.status !== 'pending') {
      throw new HTTP400Error('Only pending invitations can be canceled');
    }

    await db
      .update(orgInvitations)
      .set({ status: 'canceled' })
      .where(eq(orgInvitations.id, invitationId));
  },

  /**
   * List pending invitations — admin-only
   */
  async listInvitations(orgId: string, adminUserId: string) {
    await verifyOrgAdmin(orgId, adminUserId);

    return db
      .select({
        id: orgInvitations.id,
        orgId: orgInvitations.orgId,
        email: orgInvitations.email,
        role: orgInvitations.role,
        invitedBy: orgInvitations.invitedBy,
        inviterName: users.fullName,
        status: orgInvitations.status,
        expiresAt: orgInvitations.expiresAt,
        createdAt: orgInvitations.createdAt,
      })
      .from(orgInvitations)
      .leftJoin(users, eq(orgInvitations.invitedBy, users.id))
      .where(
        and(
          eq(orgInvitations.orgId, orgId),
          eq(orgInvitations.status, 'pending')
        )
      );
  },

  /**
   * Resend an invitation email — admin-only
   */
  async resendInvitation(orgId: string, adminUserId: string, invitationId: string) {
    await verifyOrgAdmin(orgId, adminUserId);

    const [invitation] = await db
      .select()
      .from(orgInvitations)
      .where(
        and(
          eq(orgInvitations.id, invitationId),
          eq(orgInvitations.orgId, orgId)
        )
      )
      .limit(1);

    if (!invitation) {
      throw new HTTP404Error('Invitation not found');
    }

    if (invitation.status !== 'pending') {
      throw new HTTP400Error('Only pending invitations can be resent');
    }

    if (invitation.expiresAt < new Date()) {
      throw new HTTP400Error('This invitation has expired. Please cancel and create a new one.');
    }

    // Extend expiry by 7 days
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await db
      .update(orgInvitations)
      .set({ expiresAt: newExpiresAt })
      .where(eq(orgInvitations.id, invitationId));

    // Resend email
    const [inviter] = await db
      .select({ fullName: users.fullName })
      .from(users)
      .where(eq(users.id, adminUserId))
      .limit(1);

    const [org] = await db
      .select({ name: orgs.name })
      .from(orgs)
      .where(eq(orgs.id, orgId))
      .limit(1);

    emailService
      .sendInvitationEmail(
        invitation.email,
        inviter?.fullName || 'A team admin',
        org?.name || 'your organization',
        invitation.token
      )
      .catch((err) => {
        logger.error('Failed to resend invitation email', { error: (err as Error).message });
      });
  },

  /**
   * Remove a member from the org — admin-only
   */
  async removeMember(orgId: string, adminUserId: string, memberUserId: string) {
    await verifyOrgAdmin(orgId, adminUserId);

    // Check if member exists
    const [member] = await db
      .select({ id: userOrgMembers.id, role: userOrgMembers.role })
      .from(userOrgMembers)
      .where(
        and(
          eq(userOrgMembers.userId, memberUserId),
          eq(userOrgMembers.orgId, orgId)
        )
      )
      .limit(1);

    if (!member) {
      throw new HTTP404Error('Member not found');
    }

    // Prevent removing the last admin
    if (member.role === 'admin') {
      const adminCount = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(userOrgMembers)
        .where(
          and(
            eq(userOrgMembers.orgId, orgId),
            eq(userOrgMembers.role, 'admin')
          )
        );
      if ((adminCount[0]?.count ?? 0) <= 1) {
        throw new HTTP400Error('Cannot remove the last admin. Assign another admin first.');
      }
    }

    // Delete membership
    await db
      .delete(userOrgMembers)
      .where(
        and(
          eq(userOrgMembers.userId, memberUserId),
          eq(userOrgMembers.orgId, orgId)
        )
      );

    // Recalculate and update Stripe seat quantity
    const memberCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(userOrgMembers)
      .where(eq(userOrgMembers.orgId, orgId));
    const totalMembers = memberCount[0]?.count ?? 0;
    const paidSeats = Math.max(0, totalMembers - SEAT_BILLING.INCLUDED_SEATS);
    await stripeService.updateSeatQuantity(orgId, paidSeats);
  },

  /**
   * Change a member's role — admin-only
   */
  async changeMemberRole(
    orgId: string,
    adminUserId: string,
    memberUserId: string,
    newRole: 'admin' | 'member'
  ) {
    await verifyOrgAdmin(orgId, adminUserId);

    // Get current role
    const [member] = await db
      .select({ role: userOrgMembers.role })
      .from(userOrgMembers)
      .where(
        and(
          eq(userOrgMembers.userId, memberUserId),
          eq(userOrgMembers.orgId, orgId)
        )
      )
      .limit(1);

    if (!member) {
      throw new HTTP404Error('Member not found');
    }

    // Prevent demoting the last admin
    if (member.role === 'admin' && newRole === 'member') {
      const adminCount = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(userOrgMembers)
        .where(
          and(
            eq(userOrgMembers.orgId, orgId),
            eq(userOrgMembers.role, 'admin')
          )
        );
      if ((adminCount[0]?.count ?? 0) <= 1) {
        throw new HTTP400Error('Cannot demote the last admin. Assign another admin first.');
      }
    }

    await db
      .update(userOrgMembers)
      .set({ role: newRole })
      .where(
        and(
          eq(userOrgMembers.userId, memberUserId),
          eq(userOrgMembers.orgId, orgId)
        )
      );
  },

  /**
   * Get seat/billing info for the org
   */
  async getSeatInfo(orgId: string) {
    const memberCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(userOrgMembers)
      .where(eq(userOrgMembers.orgId, orgId));

    const pendingCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(orgInvitations)
      .where(
        and(
          eq(orgInvitations.orgId, orgId),
          eq(orgInvitations.status, 'pending')
        )
      );

    const totalMembers = memberCount[0]?.count ?? 0;
    const pendingInvitations = pendingCount[0]?.count ?? 0;

    return {
      totalMembers,
      pendingInvitations,
      includedSeats: SEAT_BILLING.INCLUDED_SEATS,
      paidSeats: Math.max(0, totalMembers - SEAT_BILLING.INCLUDED_SEATS),
      seatPriceMonthly: SEAT_BILLING.SEAT_PRICE_MONTHLY,
    };
  },

  /**
   * Get invitation info by token (public — no auth required)
   */
  async getInviteInfo(token: string) {
    const [invitation] = await db
      .select({
        email: orgInvitations.email,
        status: orgInvitations.status,
        expiresAt: orgInvitations.expiresAt,
        orgName: orgs.name,
        inviterName: users.fullName,
      })
      .from(orgInvitations)
      .innerJoin(orgs, eq(orgInvitations.orgId, orgs.id))
      .leftJoin(users, eq(orgInvitations.invitedBy, users.id))
      .where(eq(orgInvitations.token, token))
      .limit(1);

    if (!invitation) {
      throw new HTTP404Error('Invitation not found');
    }

    if (invitation.status !== 'pending') {
      throw new HTTP400Error('This invitation is no longer valid');
    }

    if (invitation.expiresAt < new Date()) {
      throw new HTTP400Error('This invitation has expired');
    }

    return {
      orgName: invitation.orgName,
      inviterName: invitation.inviterName || 'A team admin',
      email: invitation.email,
      expiresAt: invitation.expiresAt.toISOString(),
    };
  },
};
