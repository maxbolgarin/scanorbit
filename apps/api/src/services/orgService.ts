import crypto from 'crypto';
import { eq, and, asc } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { HTTP403Error, HTTP404Error } from '../lib/errors.js';
import { orgs, userOrgMembers, users } from '../db/schema.js';
import type { Org } from '../db/schema.js';
import { orgsCreatedTotal } from '../lib/metrics.js';

// Generate URL-safe slug from org name
function generateSlug(name: string): string {
  const baseSlug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 50);

  // Add cryptographically random suffix to ensure uniqueness
  const suffix = crypto.randomUUID().substring(0, 8);
  return `${baseSlug}-${suffix}`;
}

interface UpdateOrgData {
  name?: string;
  logoUrl?: string | null;
}

/**
 * Verify that a user is an admin of an organization
 * Throws HTTP403Error if not authorized
 */
export async function verifyOrgAdmin(orgId: string, userId: string): Promise<void> {
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
    throw new HTTP403Error('Only admins can perform this action');
  }
}

export const orgService = {
  /**
   * Create an org and add user as admin (with optional title and fullName update)
   * Returns the created org
   */
  async createOrg(
    userId: string,
    orgName: string,
    fullName?: string,
    title?: string
  ): Promise<{ org: Pick<Org, 'id' | 'name' | 'slug'> }> {
    const slug = generateSlug(orgName.trim());

    // Use transaction to ensure data consistency
    const org = await db.transaction(async (tx) => {
      // Create org
      const [createdOrg] = await tx
        .insert(orgs)
        .values({
          name: orgName.trim(),
          slug,
        })
        .returning({
          id: orgs.id,
          name: orgs.name,
          slug: orgs.slug,
        });

      // Add user as admin with title
      await tx.insert(userOrgMembers).values({
        userId,
        orgId: createdOrg.id,
        role: 'admin',
        title: title || null,
      });

      // Update user's full name if provided
      if (fullName) {
        await tx
          .update(users)
          .set({
            fullName,
            updatedAt: new Date(),
          })
          .where(eq(users.id, userId));
      }

      return createdOrg;
    });

    orgsCreatedTotal.inc();

    return { org };
  },

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

  async getOrgAdminEmail(orgId: string): Promise<{ email: string; name: string | null } | null> {
    // Order by membership creation date to consistently pick the earliest (founding) admin
    const [admin] = await db
      .select({ email: users.email, fullName: users.fullName })
      .from(users)
      .innerJoin(userOrgMembers, eq(users.id, userOrgMembers.userId))
      .where(and(eq(userOrgMembers.orgId, orgId), eq(userOrgMembers.role, 'admin')))
      .orderBy(asc(userOrgMembers.createdAt))
      .limit(1);

    return admin ? { email: admin.email, name: admin.fullName } : null;
  },

  /**
   * Get limited org info for public API
   */
  async getOrgPublic(orgId: string) {
    const [org] = await db
      .select({
        id: orgs.id,
        name: orgs.name,
        slug: orgs.slug,
      })
      .from(orgs)
      .where(eq(orgs.id, orgId))
      .limit(1);

    if (!org) {
      throw new HTTP404Error('Organization not found');
    }

    return org;
  },
};
