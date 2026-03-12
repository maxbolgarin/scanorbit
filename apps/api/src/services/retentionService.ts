import { db } from '../lib/db.js';
import {
  resources,
  findings,
  auditLogs,
  dataDeletionRequests,
  users,
  userOrgMembers,
  orgs,
  consentLogs,
  dripLog,
} from '../db/schema.js';
import { listmonkService } from './listmonkService.js';
import { stripeService } from './stripeService.js';
import { refreshTokenStore } from '../lib/redis.js';
import { eq, and, lt, lte, isNotNull, sql, count } from 'drizzle-orm';
import { config } from '../lib/config.js';
import { logger } from '../lib/logger.js';
import { ACTIVE_SCAN_STATUSES, type SubscriptionTier } from '../types/index.js';

/**
 * GDPR Compliance - Data Retention Service
 *
 * Handles automatic cleanup of data according to tier-based retention policies:
 * - Stale resources (not seen for X days, varies by tier)
 * - Resolved findings (resolved more than X days ago, varies by tier)
 * - Old scan records (varies by tier)
 * - Archived audit logs (older than 2 years, global)
 * - Pending deletion requests that have passed grace period
 */

// Per-tier retention periods (in days)
export const TIER_RETENTION: Record<SubscriptionTier, {
  resourcesDays: number;
  findingsResolvedDays: number;
  scansDays: number;
}> = {
  free: { resourcesDays: 7, findingsResolvedDays: 14, scansDays: 30 },
  pro: { resourcesDays: 90, findingsResolvedDays: 180, scansDays: 365 },
  team: { resourcesDays: 180, findingsResolvedDays: 365, scansDays: 730 },
};

// Audit logs use a global retention period (GDPR compliance)
const RETENTION_AUDIT_LOGS_DAYS = config.retentionAuditLogsDays ?? 730; // 2 years

interface RetentionResult {
  resourcesDeleted: number;
  findingsDeleted: number;
  scansDeleted: number;
  auditLogsArchived: number;
  deletionRequestsProcessed: number;
  errors: string[];
}

/**
 * Run all retention cleanup tasks
 */
export async function runRetentionCleanup(): Promise<RetentionResult> {
  const result: RetentionResult = {
    resourcesDeleted: 0,
    findingsDeleted: 0,
    scansDeleted: 0,
    auditLogsArchived: 0,
    deletionRequestsProcessed: 0,
    errors: [],
  };

  logger.info('[Retention] Starting retention cleanup', {
    tierRetention: TIER_RETENTION,
    auditDays: RETENTION_AUDIT_LOGS_DAYS,
  });

  // 1. Delete stale resources
  try {
    result.resourcesDeleted = await deleteStaleResources();
    logger.info('[Retention] Deleted stale resources', { count: result.resourcesDeleted });
  } catch (err) {
    const message = `Failed to delete stale resources: ${err}`;
    logger.error(`[Retention] ${  message}`);
    result.errors.push(message);
  }

  // 2. Delete old resolved findings
  try {
    result.findingsDeleted = await deleteOldResolvedFindings();
    logger.info('[Retention] Deleted old resolved findings', { count: result.findingsDeleted });
  } catch (err) {
    const message = `Failed to delete old findings: ${err}`;
    logger.error(`[Retention] ${  message}`);
    result.errors.push(message);
  }

  // 3. Delete old scan records
  try {
    result.scansDeleted = await deleteOldScans();
    logger.info('[Retention] Deleted old scan records', { count: result.scansDeleted });
  } catch (err) {
    const message = `Failed to delete old scans: ${err}`;
    logger.error(`[Retention] ${  message}`);
    result.errors.push(message);
  }

  // 4. Archive old audit logs (delete if older than retention period)
  try {
    result.auditLogsArchived = await archiveOldAuditLogs();
    logger.info('[Retention] Archived old audit logs', { count: result.auditLogsArchived });
  } catch (err) {
    const message = `Failed to archive audit logs: ${err}`;
    logger.error(`[Retention] ${  message}`);
    result.errors.push(message);
  }

  // 5. Process pending deletion requests that have passed grace period
  try {
    result.deletionRequestsProcessed = await processPendingDeletions();
    logger.info('[Retention] Processed deletion requests', { count: result.deletionRequestsProcessed });
  } catch (err) {
    const message = `Failed to process deletion requests: ${err}`;
    logger.error(`[Retention] ${  message}`);
    result.errors.push(message);
  }

  logger.info('[Retention] Cleanup completed', { ...result });
  return result;
}

/**
 * Delete resources that haven't been seen for longer than their org's tier-based retention period
 */
async function deleteStaleResources(): Promise<number> {
  const result = await db.execute(sql`
    DELETE FROM resources
    WHERE id IN (
      SELECT r.id FROM resources r
      JOIN orgs o ON r.org_id = o.id
      WHERE r.last_seen_at IS NOT NULL
      AND (
        (o.tier = 'free' AND r.last_seen_at < NOW() - INTERVAL '${sql.raw(String(TIER_RETENTION.free.resourcesDays))} days')
        OR (o.tier = 'pro' AND r.last_seen_at < NOW() - INTERVAL '${sql.raw(String(TIER_RETENTION.pro.resourcesDays))} days')
        OR (o.tier = 'team' AND r.last_seen_at < NOW() - INTERVAL '${sql.raw(String(TIER_RETENTION.team.resourcesDays))} days')
      )
    )
  `);
  return Number(result.rowCount ?? 0);
}

/**
 * Delete findings that have been resolved for longer than their org's tier-based retention period
 */
async function deleteOldResolvedFindings(): Promise<number> {
  const result = await db.execute(sql`
    DELETE FROM findings
    WHERE id IN (
      SELECT f.id FROM findings f
      JOIN orgs o ON f.org_id = o.id
      WHERE f.status = 'resolved'
      AND f.resolved_at IS NOT NULL
      AND (
        (o.tier = 'free' AND f.resolved_at < NOW() - INTERVAL '${sql.raw(String(TIER_RETENTION.free.findingsResolvedDays))} days')
        OR (o.tier = 'pro' AND f.resolved_at < NOW() - INTERVAL '${sql.raw(String(TIER_RETENTION.pro.findingsResolvedDays))} days')
        OR (o.tier = 'team' AND f.resolved_at < NOW() - INTERVAL '${sql.raw(String(TIER_RETENTION.team.findingsResolvedDays))} days')
      )
    )
  `);
  return Number(result.rowCount ?? 0);
}

/**
 * Delete scan records older than their org's tier-based retention period
 * Excludes active scans that are still being processed
 */
async function deleteOldScans(): Promise<number> {
  // Build parameterized status exclusion list to avoid sql.raw with string values
  const statusPlaceholders = ACTIVE_SCAN_STATUSES.map(s => sql`${s}`);
  const statusList = sql.join(statusPlaceholders, sql`, `);

  const result = await db.execute(sql`
    DELETE FROM scans
    WHERE id IN (
      SELECT s.id FROM scans s
      JOIN orgs o ON s.org_id = o.id
      WHERE s.status NOT IN (${statusList})
      AND (
        (o.tier = 'free' AND s.created_at < NOW() - INTERVAL '${sql.raw(String(TIER_RETENTION.free.scansDays))} days')
        OR (o.tier = 'pro' AND s.created_at < NOW() - INTERVAL '${sql.raw(String(TIER_RETENTION.pro.scansDays))} days')
        OR (o.tier = 'team' AND s.created_at < NOW() - INTERVAL '${sql.raw(String(TIER_RETENTION.team.scansDays))} days')
      )
    )
  `);
  return Number(result.rowCount ?? 0);
}

/**
 * Archive (delete) audit logs older than retention period
 * GDPR requires keeping audit logs for investigation purposes,
 * but after 2 years they can be safely deleted
 */
async function archiveOldAuditLogs(): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_AUDIT_LOGS_DAYS);

  // Delete old audit logs
  const deleted = await db
    .delete(auditLogs)
    .where(lt(auditLogs.timestamp, cutoffDate))
    .returning({ id: auditLogs.id });

  return deleted.length;
}

/**
 * Process pending deletion requests that have passed their grace period
 */
async function processPendingDeletions(): Promise<number> {
  const now = new Date();

  // Find pending requests where scheduled deletion time has passed
  const pendingRequests = await db
    .select()
    .from(dataDeletionRequests)
    .where(
      and(
        eq(dataDeletionRequests.status, 'pending'),
        isNotNull(dataDeletionRequests.scheduledDeletionAt),
        lte(dataDeletionRequests.scheduledDeletionAt, now)
      )
    );

  let processedCount = 0;

  for (const request of pendingRequests) {
    if (!request.userId) {
      logger.warn('[Retention] Skipping deletion request with null userId', { requestId: request.id });
      continue;
    }
    try {
      await processUserDeletion(request.userId, request.id);
      processedCount++;
    } catch (err) {
      logger.error('[Retention] Failed to process deletion for user', err as Error, { userId: request.userId });
      // Mark as failed
      await db
        .update(dataDeletionRequests)
        .set({
          status: 'failed',
          processedAt: new Date(),
          notes: `Processing failed: ${err}`,
        })
        .where(eq(dataDeletionRequests.id, request.id));
    }
  }

  return processedCount;
}

/**
 * Process a user deletion request - anonymize/delete user data
 */
async function processUserDeletion(userId: string, requestId: string): Promise<void> {
  logger.info('[Retention] Processing deletion for user', { userId });

  // Get user email before deletion (needed for external service cleanup)
  const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
  const userEmail = user?.email;

  // Delete subscriber from Listmonk (full GDPR erasure, not just blocklist)
  if (userEmail) {
    try {
      await listmonkService.deleteSubscriber(userEmail);
    } catch (err) {
      logger.error('[Retention] Failed to delete user from Listmonk', err as Error, { userId });
    }
  }

  // Revoke all refresh tokens in Redis so user can't continue using the API
  try {
    await refreshTokenStore.revokeAllForUser(userId);
  } catch (err) {
    logger.error('[Retention] Failed to revoke refresh tokens', err as Error, { userId });
  }

  // Find orgs where user is a member (for Stripe cleanup and orphan detection)
  const userOrgs = await db
    .select({
      orgId: userOrgMembers.orgId,
      stripeSubscriptionId: orgs.stripeSubscriptionId,
      stripeCustomerId: orgs.stripeCustomerId,
    })
    .from(userOrgMembers)
    .innerJoin(orgs, eq(orgs.id, userOrgMembers.orgId))
    .where(eq(userOrgMembers.userId, userId));

  // Cancel Stripe subscriptions BEFORE the DB transaction to avoid
  // inconsistency if DB rolls back after Stripe calls succeed
  const orphanedOrgIds: string[] = [];
  for (const org of userOrgs) {
    // Check member count to find orphaned orgs (will become 0 after user removal)
    const [memberCount] = await db
      .select({ count: count() })
      .from(userOrgMembers)
      .where(eq(userOrgMembers.orgId, org.orgId));

    // Will be orphaned after this user is removed (count === 1 means only this user)
    if (memberCount.count <= 1) {
      orphanedOrgIds.push(org.orgId);
      if (stripeService.isConfigured()) {
        try {
          if (org.stripeSubscriptionId) {
            await stripeService.cancelSubscriptionById(org.stripeSubscriptionId);
          }
          if (org.stripeCustomerId) {
            await stripeService.deleteCustomer(org.stripeCustomerId);
          }
        } catch (err) {
          logger.error('[Retention] Failed Stripe cleanup for org', err as Error, { orgId: org.orgId });
        }
      }
    }
  }

  // Use a transaction for atomic deletion
  await db.transaction(async (tx) => {
    // Lock user row to prevent concurrent deletion processing
    const [lockedUser] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .for('update')
      .limit(1);

    if (!lockedUser) {
      // User already deleted by concurrent process
      return;
    }

    // 1. Remove user from all organizations
    await tx
      .delete(userOrgMembers)
      .where(eq(userOrgMembers.userId, userId));

    // 2. Delete orphaned orgs — cascades to all org data
    for (const orgId of orphanedOrgIds) {
      await tx.delete(orgs).where(eq(orgs.id, orgId));
      logger.info('[Retention] Deleted orphaned org', { orgId });
    }

    // 3. Anonymize audit logs (keep for compliance, remove PII)
    await tx
      .update(auditLogs)
      .set({
        userId: null,
        ipAddress: null,
        userAgent: null,
      })
      .where(eq(auditLogs.userId, userId));

    // 4. Delete email marketing history (dripLog contains subscriber email)
    if (userEmail) {
      await tx
        .delete(dripLog)
        .where(eq(dripLog.subscriberEmail, userEmail));
    }

    // 5. Anonymize consent logs (keep records for legal basis, remove PII)
    await tx
      .update(consentLogs)
      .set({
        userId: null,
        email: `deleted-${userId.slice(0, 8)}@anonymized`,
      })
      .where(eq(consentLogs.userId, userId));

    // 6. Mark deletion request as completed and anonymize email
    // Must happen BEFORE user deletion to avoid ON DELETE SET NULL nullifying userId
    await tx
      .update(dataDeletionRequests)
      .set({
        status: 'completed',
        processedAt: new Date(),
        email: `deleted-${userId.slice(0, 8)}@anonymized`,
        notes: 'User data deleted successfully',
      })
      .where(eq(dataDeletionRequests.id, requestId));

    // 7. Delete the user account (must be last — cascades to OAuth accounts, org memberships)
    await tx
      .delete(users)
      .where(eq(users.id, userId));
  });

  logger.info('[Retention] Successfully deleted user', { userId });
}

/**
 * Get retention statistics for monitoring
 * Uses the shortest retention period (free tier) for counting eligible records
 */
export async function getRetentionStats(): Promise<{
  pendingDeletions: number;
  staleResources: number;
  oldFindings: number;
  oldAuditLogs: number;
}> {
  // Use free tier (shortest) cutoffs to show maximum eligible records
  const resourcesCutoff = new Date();
  resourcesCutoff.setDate(resourcesCutoff.getDate() - TIER_RETENTION.free.resourcesDays);

  const findingsCutoff = new Date();
  findingsCutoff.setDate(findingsCutoff.getDate() - TIER_RETENTION.free.findingsResolvedDays);

  const auditCutoff = new Date();
  auditCutoff.setDate(auditCutoff.getDate() - RETENTION_AUDIT_LOGS_DAYS);

  const [pendingDeletionsResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(dataDeletionRequests)
    .where(eq(dataDeletionRequests.status, 'pending'));

  const [staleResourcesResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(resources)
    .where(
      and(
        isNotNull(resources.lastSeenAt),
        lt(resources.lastSeenAt, resourcesCutoff)
      )
    );

  const [oldFindingsResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(findings)
    .where(
      and(
        eq(findings.status, 'resolved'),
        isNotNull(findings.resolvedAt),
        lt(findings.resolvedAt, findingsCutoff)
      )
    );

  const [oldAuditLogsResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(auditLogs)
    .where(lt(auditLogs.timestamp, auditCutoff));

  return {
    pendingDeletions: Number(pendingDeletionsResult?.count ?? 0),
    staleResources: Number(staleResourcesResult?.count ?? 0),
    oldFindings: Number(oldFindingsResult?.count ?? 0),
    oldAuditLogs: Number(oldAuditLogsResult?.count ?? 0),
  };
}
