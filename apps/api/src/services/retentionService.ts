import { db } from '../lib/db.js';
import {
  resources,
  findings,
  scans,
  auditLogs,
  dataDeletionRequests,
  users,
  userOrgMembers,
} from '../db/schema.js';
import { listmonkService } from './listmonkService.js';
import { eq, and, lt, lte, isNotNull, sql } from 'drizzle-orm';
import { config } from '../lib/config.js';

/**
 * GDPR Compliance - Data Retention Service
 *
 * Handles automatic cleanup of data according to retention policies:
 * - Stale resources (not seen for X days)
 * - Resolved findings (resolved more than X days ago)
 * - Old scan records
 * - Archived audit logs (older than 2 years)
 * - Pending deletion requests that have passed grace period
 */

// Get retention days from config with defaults
const RETENTION_RESOURCES_DAYS = config.retentionResourcesDays ?? 90;
const RETENTION_FINDINGS_RESOLVED_DAYS = config.retentionFindingsResolvedDays ?? 180;
const RETENTION_SCANS_DAYS = config.retentionScansDays ?? 365;
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

  console.log('[Retention] Starting retention cleanup...');
  console.log(`[Retention] Retention periods: resources=${RETENTION_RESOURCES_DAYS}d, findings=${RETENTION_FINDINGS_RESOLVED_DAYS}d, scans=${RETENTION_SCANS_DAYS}d, audit=${RETENTION_AUDIT_LOGS_DAYS}d`);

  // 1. Delete stale resources
  try {
    result.resourcesDeleted = await deleteStaleResources();
    console.log(`[Retention] Deleted ${result.resourcesDeleted} stale resources`);
  } catch (err) {
    const message = `Failed to delete stale resources: ${err}`;
    console.error(`[Retention] ${message}`);
    result.errors.push(message);
  }

  // 2. Delete old resolved findings
  try {
    result.findingsDeleted = await deleteOldResolvedFindings();
    console.log(`[Retention] Deleted ${result.findingsDeleted} old resolved findings`);
  } catch (err) {
    const message = `Failed to delete old findings: ${err}`;
    console.error(`[Retention] ${message}`);
    result.errors.push(message);
  }

  // 3. Delete old scan records
  try {
    result.scansDeleted = await deleteOldScans();
    console.log(`[Retention] Deleted ${result.scansDeleted} old scan records`);
  } catch (err) {
    const message = `Failed to delete old scans: ${err}`;
    console.error(`[Retention] ${message}`);
    result.errors.push(message);
  }

  // 4. Archive old audit logs (delete if older than retention period)
  try {
    result.auditLogsArchived = await archiveOldAuditLogs();
    console.log(`[Retention] Archived ${result.auditLogsArchived} old audit logs`);
  } catch (err) {
    const message = `Failed to archive audit logs: ${err}`;
    console.error(`[Retention] ${message}`);
    result.errors.push(message);
  }

  // 5. Process pending deletion requests that have passed grace period
  try {
    result.deletionRequestsProcessed = await processPendingDeletions();
    console.log(`[Retention] Processed ${result.deletionRequestsProcessed} deletion requests`);
  } catch (err) {
    const message = `Failed to process deletion requests: ${err}`;
    console.error(`[Retention] ${message}`);
    result.errors.push(message);
  }

  console.log('[Retention] Cleanup completed:', result);
  return result;
}

/**
 * Delete resources that haven't been seen for longer than retention period
 */
async function deleteStaleResources(): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_RESOURCES_DAYS);

  // Delete resources where lastSeenAt is older than cutoff
  const deleted = await db
    .delete(resources)
    .where(
      and(
        isNotNull(resources.lastSeenAt),
        lt(resources.lastSeenAt, cutoffDate)
      )
    )
    .returning({ id: resources.id });

  return deleted.length;
}

/**
 * Delete findings that have been resolved for longer than retention period
 */
async function deleteOldResolvedFindings(): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_FINDINGS_RESOLVED_DAYS);

  // Delete resolved findings older than cutoff
  const deleted = await db
    .delete(findings)
    .where(
      and(
        eq(findings.status, 'resolved'),
        isNotNull(findings.resolvedAt),
        lt(findings.resolvedAt, cutoffDate)
      )
    )
    .returning({ id: findings.id });

  return deleted.length;
}

/**
 * Delete scan records older than retention period
 */
async function deleteOldScans(): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_SCANS_DAYS);

  // Delete old scans
  const deleted = await db
    .delete(scans)
    .where(lt(scans.startedAt, cutoffDate))
    .returning({ id: scans.id });

  return deleted.length;
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
    try {
      await processUserDeletion(request.userId, request.id);
      processedCount++;
    } catch (err) {
      console.error(`[Retention] Failed to process deletion for user ${request.userId}:`, err);
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
  console.log(`[Retention] Processing deletion for user ${userId}`);

  // Unsubscribe from Listmonk before deleting user data
  try {
    const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
    if (user?.email) {
      await listmonkService.unsubscribe(user.email);
    }
  } catch (err) {
    console.error(`[Retention] Failed to unsubscribe ${userId} from Listmonk:`, err);
  }

  // Use a transaction for atomic deletion
  await db.transaction(async (tx) => {
    // 1. Remove user from all organizations
    await tx
      .delete(userOrgMembers)
      .where(eq(userOrgMembers.userId, userId));

    // 2. Anonymize audit logs (keep for compliance, remove PII)
    await tx
      .update(auditLogs)
      .set({
        userId: null,
        ipAddress: null,
        userAgent: null,
      })
      .where(eq(auditLogs.userId, userId));

    // 3. Delete the user account
    await tx
      .delete(users)
      .where(eq(users.id, userId));

    // 4. Mark deletion request as completed
    await tx
      .update(dataDeletionRequests)
      .set({
        status: 'completed',
        processedAt: new Date(),
        notes: 'User data deleted successfully',
      })
      .where(eq(dataDeletionRequests.id, requestId));
  });

  console.log(`[Retention] Successfully deleted user ${userId}`);
}

/**
 * Get retention statistics for monitoring
 */
export async function getRetentionStats(): Promise<{
  pendingDeletions: number;
  staleResources: number;
  oldFindings: number;
  oldAuditLogs: number;
}> {
  const resourcesCutoff = new Date();
  resourcesCutoff.setDate(resourcesCutoff.getDate() - RETENTION_RESOURCES_DAYS);

  const findingsCutoff = new Date();
  findingsCutoff.setDate(findingsCutoff.getDate() - RETENTION_FINDINGS_RESOLVED_DAYS);

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
