import { eq, and } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { HTTP403Error } from '../lib/errors.js';
import { bugReports, userOrgMembers, users, orgs } from '../db/schema.js';
import { emailService } from './emailService.js';
import { logger } from '../lib/logger.js';
import type { BugReport } from '../db/schema.js';

interface CreateBugReportData {
  title: string;
  description: string;
  category: string;
  screenshotUrl?: string | null;
  metadata?: Record<string, unknown>;
}

export const bugReportService = {
  async create(orgId: string, userId: string, data: CreateBugReportData): Promise<BugReport> {
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

    const [report] = await db
      .insert(bugReports)
      .values({
        orgId,
        userId,
        title: data.title,
        description: data.description,
        category: data.category,
        screenshotUrl: data.screenshotUrl ?? null,
        metadata: data.metadata ?? {},
      })
      .returning();

    // Send email notification (fire-and-forget)
    this.sendNotification(userId, orgId, data).catch((err) => {
      logger.error('Failed to send bug report notification email', err as Error);
    });

    return report;
  },

  async sendNotification(userId: string, orgId: string, data: CreateBugReportData): Promise<void> {
    const [[user], [org]] = await Promise.all([
      db.select({ email: users.email, fullName: users.fullName }).from(users).where(eq(users.id, userId)).limit(1),
      db.select({ name: orgs.name }).from(orgs).where(eq(orgs.id, orgId)).limit(1),
    ]);

    if (!user || !org) return;

    await emailService.sendBugReportNotification(
      data.title,
      data.description,
      data.category,
      user.email,
      user.fullName ?? undefined,
      org.name,
      data.metadata ?? {},
    );
  },
};
