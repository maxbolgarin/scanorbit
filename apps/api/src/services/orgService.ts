import { eq, and } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { HTTP403Error, HTTP404Error } from '../lib/errors.js';
import { orgs, userOrgMembers } from '../db/schema.js';
import type { Org } from '../db/schema.js';

interface UpdateOrgData {
  name?: string;
  logoUrl?: string | null;
}

export const orgService = {
  async getOrg(orgId: string, userId: string): Promise<Org> {
    // Verify user has access to org
    const [membership] = await db
      .select({ role: userOrgMembers.role })
      .from(userOrgMembers)
      .where(
        and(
          eq(userOrgMembers.userId, userId),
          eq(userOrgMembers.orgId, orgId)
        )
      )
      .limit(1);

    if (!membership) {
      throw new HTTP403Error('You do not have access to this organization');
    }

    // Get org
    const [org] = await db
      .select()
      .from(orgs)
      .where(eq(orgs.id, orgId))
      .limit(1);

    if (!org) {
      throw new HTTP404Error('Organization not found');
    }

    return org;
  },

  async updateOrg(
    orgId: string,
    userId: string,
    data: UpdateOrgData
  ): Promise<Org> {
    // Verify user is admin of org
    const [membership] = await db
      .select({ role: userOrgMembers.role })
      .from(userOrgMembers)
      .where(
        and(
          eq(userOrgMembers.userId, userId),
          eq(userOrgMembers.orgId, orgId)
        )
      )
      .limit(1);

    if (!membership) {
      throw new HTTP403Error('You do not have access to this organization');
    }

    if (membership.role !== 'admin') {
      throw new HTTP403Error('Only admins can update organization settings');
    }

    // Update org
    const [org] = await db
      .update(orgs)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(orgs.id, orgId))
      .returning();

    if (!org) {
      throw new HTTP404Error('Organization not found');
    }

    return org;
  },

  async getUserOrgs(userId: string) {
    return db
      .select({
        id: orgs.id,
        name: orgs.name,
        slug: orgs.slug,
        logoUrl: orgs.logoUrl,
        role: userOrgMembers.role,
        createdAt: orgs.createdAt,
      })
      .from(orgs)
      .innerJoin(userOrgMembers, eq(orgs.id, userOrgMembers.orgId))
      .where(eq(userOrgMembers.userId, userId));
  },

  async getOrgMembers(orgId: string, userId: string) {
    // Verify user has access to org
    const [membership] = await db
      .select({ role: userOrgMembers.role })
      .from(userOrgMembers)
      .where(
        and(
          eq(userOrgMembers.userId, userId),
          eq(userOrgMembers.orgId, orgId)
        )
      )
      .limit(1);

    if (!membership) {
      throw new HTTP403Error('You do not have access to this organization');
    }

    // Import users table for the join
    const { users } = await import('../db/schema.js');

    return db
      .select({
        id: userOrgMembers.id,
        userId: userOrgMembers.userId,
        role: userOrgMembers.role,
        email: users.email,
        fullName: users.fullName,
        createdAt: userOrgMembers.createdAt,
      })
      .from(userOrgMembers)
      .innerJoin(users, eq(userOrgMembers.userId, users.id))
      .where(eq(userOrgMembers.orgId, orgId));
  },
};
