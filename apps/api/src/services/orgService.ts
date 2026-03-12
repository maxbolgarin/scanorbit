import crypto from 'crypto';
import { eq, and, desc, gte } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { HTTP400Error, HTTP403Error, HTTP404Error } from '../lib/errors.js';
import { orgs, userOrgMembers, users, scans } from '../db/schema.js';
import type { Org } from '../db/schema.js';
import { TIER_LIMITS, ScanStatus, type SubscriptionTier, type SubscriptionStatus } from '../types/index.js';
import { logger } from '../lib/logger.js';
import { orgsCreatedTotal } from '../lib/metrics.js';
import { stripeService } from './stripeService.js';

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
 * Safely get organization tier, defaulting to 'free' if column doesn't exist (migration not run)
 * This is exported so it can be used in routes and other services
 */
export async function getOrgTier(orgId: string): Promise<SubscriptionTier> {
  try {
    const [org] = await db
      .select({ tier: orgs.tier })
      .from(orgs)
      .where(eq(orgs.id, orgId))
      .limit(1);

    return (org?.tier || 'free') as SubscriptionTier;
  } catch (error) {
    // If tier column doesn't exist (migration not run), default to 'free'
    const err = error as Error;
    if (err.message.includes('column') && err.message.includes('tier')) {
      logger.warn('Tier column not found, defaulting to free tier', {
        orgId,
        error: err.message,
      });
      return 'free';
    }
    // Re-throw other database errors
    throw error;
  }
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

  /**
   * Get subscription status for an organization
   */
  async getSubscriptionStatus(orgId: string, userId: string): Promise<SubscriptionStatus> {
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

    // Get org with tier and subscription fields
    const [org] = await db
      .select({
        tier: orgs.tier,
        tierUpgradedAt: orgs.tierUpgradedAt,
        subscriptionStatus: orgs.subscriptionStatus,
        trialEndsAt: orgs.trialEndsAt,
        subscriptionEndsAt: orgs.subscriptionEndsAt,
        stripeCustomerId: orgs.stripeCustomerId,
      })
      .from(orgs)
      .where(eq(orgs.id, orgId))
      .limit(1);

    if (!org) {
      throw new HTTP404Error('Organization not found');
    }

    // Use already-fetched tier from org query (avoids redundant DB call)
    const tier = (org.tier || 'free') as SubscriptionTier;
    const limits = TIER_LIMITS[tier];

    // Determine scan status
    let canScan = true;
    let reason: string | undefined;
    let cooldownEndsAt: string | undefined;

    if (tier === 'free') {
      // Check if org has any successful scan
      const [successfulScan] = await db
        .select({ id: scans.id })
        .from(scans)
        .where(
          and(
            eq(scans.orgId, orgId),
            eq(scans.status, ScanStatus.COMPLETE)
          )
        )
        .limit(1);

      if (successfulScan) {
        canScan = false;
        reason = 'Free tier allows only one successful scan. Upgrade to Pro for more.';
      }
    } else if (tier === 'pro') {
      // Check cooldown
      const cooldownMinutes = TIER_LIMITS.pro.scanCooldownMinutes!;
      const cooldownTime = new Date(Date.now() - cooldownMinutes * 60 * 1000);

      const [recentScan] = await db
        .select({ completedAt: scans.completedAt })
        .from(scans)
        .where(
          and(
            eq(scans.orgId, orgId),
            eq(scans.status, ScanStatus.COMPLETE),
            gte(scans.completedAt, cooldownTime)
          )
        )
        .orderBy(desc(scans.completedAt))
        .limit(1);

      if (recentScan && recentScan.completedAt) {
        canScan = false;
        const endsAt = new Date(recentScan.completedAt.getTime() + cooldownMinutes * 60 * 1000);
        cooldownEndsAt = endsAt.toISOString();
        const waitMinutes = Math.ceil((endsAt.getTime() - Date.now()) / 60000);
        reason = `Please wait ${waitMinutes} minutes before scanning again.`;
      }
    }

    return {
      tier,
      tierUpgradedAt: org.tierUpgradedAt?.toISOString() || null,
      limits,
      scanStatus: {
        canScan,
        reason,
        cooldownEndsAt,
      },
      // Stripe subscription fields
      subscriptionStatus: (org.subscriptionStatus || 'none') as SubscriptionStatus['subscriptionStatus'],
      trialEndsAt: org.trialEndsAt?.toISOString() || null,
      subscriptionEndsAt: org.subscriptionEndsAt?.toISOString() || null,
      hasPaymentMethod: !!org.stripeCustomerId,
      stripeEnabled: stripeService.isConfigured(),
    };
  },

  /**
   * Upgrade organization tier (mock implementation for demo)
   */
  async getOrgAdminEmail(orgId: string): Promise<{ email: string; name: string | null } | null> {
    const [admin] = await db
      .select({ email: users.email, fullName: users.fullName })
      .from(users)
      .innerJoin(userOrgMembers, eq(users.id, userOrgMembers.userId))
      .where(and(eq(userOrgMembers.orgId, orgId), eq(userOrgMembers.role, 'admin')))
      .limit(1);

    return admin ? { email: admin.email, name: admin.fullName } : null;
  },

  async upgradeSubscription(
    orgId: string,
    userId: string,
    targetTier: SubscriptionTier
  ): Promise<{ tier: SubscriptionTier }> {
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
      throw new HTTP403Error('Only admins can manage subscription');
    }

    // Validate target tier
    if (!['free', 'pro', 'team'].includes(targetTier)) {
      throw new HTTP400Error('Invalid tier. Must be free, pro, or team.');
    }

    // When Stripe is enabled, paid upgrades must go through Stripe checkout
    if (stripeService.isConfigured()) {
      if (targetTier !== 'free') {
        throw new HTTP400Error('Paid tier changes must go through Stripe checkout.');
      }
      // Cancel active Stripe subscription if exists
      const [org] = await db
        .select({ stripeSubscriptionId: orgs.stripeSubscriptionId, subscriptionStatus: orgs.subscriptionStatus })
        .from(orgs)
        .where(eq(orgs.id, orgId))
        .limit(1);

      if (org?.stripeSubscriptionId && ['active', 'trialing'].includes(org.subscriptionStatus || '')) {
        await stripeService.cancelSubscription(orgId, userId, false);
      }

      // Do NOT update tier here — rely on the webhook (consistent with switchPlan's design).
      // The webhook will set tier to 'free' after Stripe confirms the cancellation.
      logger.info('Subscription cancellation initiated, awaiting webhook confirmation', { orgId });
      return { tier: 'free' as SubscriptionTier };
    }

    // Only directly update tier when Stripe is NOT configured (development/testing)
    const [updated] = await db
      .update(orgs)
      .set({
        tier: targetTier,
        tierUpgradedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(orgs.id, orgId))
      .returning({ tier: orgs.tier });

    if (!updated) {
      throw new HTTP404Error('Organization not found');
    }

    return { tier: updated.tier as SubscriptionTier };
  },
};
