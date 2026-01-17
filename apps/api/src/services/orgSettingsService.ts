import { eq, and } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { HTTP403Error } from '../lib/errors.js';
import { orgSettings, userOrgMembers } from '../db/schema.js';
import type { OrgSettings } from '../db/schema.js';

// Default settings values
const DEFAULT_REQUIRED_TAGS = ['Environment', 'Owner', 'CostCenter'];

interface UpdateOrgSettingsData {
  requiredTags?: string[];
  hiddenFindingTypes?: string[];
  hideTrivial?: boolean;
}

export const orgSettingsService = {
  /**
   * Get org settings, creating default settings if they don't exist
   */
  async getSettings(orgId: string, userId: string): Promise<OrgSettings> {
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

    // Try to get existing settings
    const [existingSettings] = await db
      .select()
      .from(orgSettings)
      .where(eq(orgSettings.orgId, orgId))
      .limit(1);

    if (existingSettings) {
      return existingSettings;
    }

    // Create default settings if they don't exist
    const [newSettings] = await db
      .insert(orgSettings)
      .values({
        orgId,
        requiredTags: DEFAULT_REQUIRED_TAGS,
        hiddenFindingTypes: [],
        hideTrivial: false,
      })
      .returning();

    return newSettings;
  },

  /**
   * Update org settings (partial update)
   */
  async updateSettings(
    orgId: string,
    userId: string,
    data: UpdateOrgSettingsData
  ): Promise<OrgSettings> {
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

    // Check if settings exist, create if not
    const [existingSettings] = await db
      .select()
      .from(orgSettings)
      .where(eq(orgSettings.orgId, orgId))
      .limit(1);

    if (!existingSettings) {
      // Create with the provided data merged with defaults
      const [newSettings] = await db
        .insert(orgSettings)
        .values({
          orgId,
          requiredTags: data.requiredTags ?? DEFAULT_REQUIRED_TAGS,
          hiddenFindingTypes: data.hiddenFindingTypes ?? [],
          hideTrivial: data.hideTrivial ?? false,
        })
        .returning();

      return newSettings;
    }

    // Update existing settings
    const [updatedSettings] = await db
      .update(orgSettings)
      .set({
        ...(data.requiredTags !== undefined && { requiredTags: data.requiredTags }),
        ...(data.hiddenFindingTypes !== undefined && { hiddenFindingTypes: data.hiddenFindingTypes }),
        ...(data.hideTrivial !== undefined && { hideTrivial: data.hideTrivial }),
        updatedAt: new Date(),
      })
      .where(eq(orgSettings.orgId, orgId))
      .returning();

    return updatedSettings;
  },
};
