import { eq, and } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { notificationPreferences } from '../db/schema.js';
import type { NotificationPreference } from '../db/schema.js';

interface UpdatePreferenceParams {
  digestFrequency?: 'daily' | 'weekly' | 'off';
  timezone?: string;
  notifyScanComplete?: boolean;
  notifyCriticalFindings?: boolean;
  notifyHighFindings?: boolean;
}

const DEFAULTS = {
  digestFrequency: 'weekly' as const,
  timezone: 'UTC',
  notifyScanComplete: true,
  notifyCriticalFindings: true,
  notifyHighFindings: true,
};

export const notificationPreferenceService = {
  // Get preferences for user+org, return defaults if none exist
  async getPreferences(
    userId: string,
    orgId: string,
  ): Promise<NotificationPreference | (typeof DEFAULTS & { userId: string; orgId: string })> {
    const [existing] = await db
      .select()
      .from(notificationPreferences)
      .where(
        and(
          eq(notificationPreferences.userId, userId),
          eq(notificationPreferences.orgId, orgId),
        ),
      )
      .limit(1);

    if (existing) return existing;
    return { ...DEFAULTS, userId, orgId };
  },

  // Upsert preferences
  async updatePreferences(
    userId: string,
    orgId: string,
    params: UpdatePreferenceParams,
  ): Promise<NotificationPreference> {
    const [result] = await db
      .insert(notificationPreferences)
      .values({
        userId,
        orgId,
        ...params,
      })
      .onConflictDoUpdate({
        target: [notificationPreferences.userId, notificationPreferences.orgId],
        set: {
          ...params,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result;
  },
};
