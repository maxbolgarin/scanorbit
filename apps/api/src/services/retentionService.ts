import { db } from '../lib/db.js';
import {
  resources,
  findings,
  auditLogs,
} from '../db/schema.js';
import { eq, and, lt, isNotNull, sql } from 'drizzle-orm';
import { config } from '../lib/config.js';
import { logger } from '../lib/logger.js';
import { ACTIVE_SCAN_STATUSES } from '../types/index.js';

/**
 * Data Retention Service
 *
 * Self-host operators configure retention TTLs to prune old data:
 *   - Stale resources (not seen for RETENTION_RESOURCES_DAYS)
 *   - Resolved findings (resolved more than RETENTION_FINDINGS_DAYS ago)
 *   - Old scan records (older than RETENTION_SCANS_DAYS)
 *   - Old audit logs (older than RETENTION_AUDIT_LOGS_DAYS)
 */

const RETENTION_RESOURCES_DAYS = config.retentionResourcesDays ?? 180;
const RETENTION_FINDINGS_DAYS = config.retentionFindingsResolvedDays ?? 365;
const RETENTION_SCANS_DAYS = config.retentionScansDays ?? 730;
const RETENTION_AUDIT_LOGS_DAYS = config.retentionAuditLogsDays ?? 730;

interface RetentionResult {
  resourcesDeleted: number;
  findingsDeleted: number;
  scansDeleted: number;
  auditLogsArchived: number;
  errors: string[];
}

export async function runRetentionCleanup(): Promise<RetentionResult> {
  const result: RetentionResult = {
    resourcesDeleted: 0,
    findingsDeleted: 0,
    scansDeleted: 0,
    auditLogsArchived: 0,
    errors: [],
  };

  logger.info('[Retention] Starting retention cleanup', {
    resourcesDays: RETENTION_RESOURCES_DAYS,
    findingsDays: RETENTION_FINDINGS_DAYS,
    scansDays: RETENTION_SCANS_DAYS,
    auditDays: RETENTION_AUDIT_LOGS_DAYS,
  });

  try {
    result.resourcesDeleted = await deleteStaleResources();
    logger.info('[Retention] Deleted stale resources', { count: result.resourcesDeleted });
  } catch (err) {
    const message = `Failed to delete stale resources: ${err}`;
    logger.error(`[Retention] ${  message}`);
    result.errors.push(message);
  }

  try {
    result.findingsDeleted = await deleteOldResolvedFindings();
    logger.info('[Retention] Deleted old resolved findings', { count: result.findingsDeleted });
  } catch (err) {
    const message = `Failed to delete old findings: ${err}`;
    logger.error(`[Retention] ${  message}`);
    result.errors.push(message);
  }

  try {
    result.scansDeleted = await deleteOldScans();
    logger.info('[Retention] Deleted old scan records', { count: result.scansDeleted });
  } catch (err) {
    const message = `Failed to delete old scans: ${err}`;
    logger.error(`[Retention] ${  message}`);
    result.errors.push(message);
  }

  try {
    result.auditLogsArchived = await archiveOldAuditLogs();
    logger.info('[Retention] Archived old audit logs', { count: result.auditLogsArchived });
  } catch (err) {
    const message = `Failed to archive audit logs: ${err}`;
    logger.error(`[Retention] ${  message}`);
    result.errors.push(message);
  }

  logger.info('[Retention] Cleanup completed', { ...result });
  return result;
}

async function deleteStaleResources(): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_RESOURCES_DAYS);

  const deleted = await db
    .delete(resources)
    .where(
      and(
        isNotNull(resources.lastSeenAt),
        lt(resources.lastSeenAt, cutoff)
      )
    )
    .returning({ id: resources.id });
  return deleted.length;
}

async function deleteOldResolvedFindings(): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_FINDINGS_DAYS);

  const deleted = await db
    .delete(findings)
    .where(
      and(
        eq(findings.status, 'resolved'),
        isNotNull(findings.resolvedAt),
        lt(findings.resolvedAt, cutoff)
      )
    )
    .returning({ id: findings.id });
  return deleted.length;
}

async function deleteOldScans(): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_SCANS_DAYS);

  const statusPlaceholders = ACTIVE_SCAN_STATUSES.map(s => sql`${s}`);
  const statusList = sql.join(statusPlaceholders, sql`, `);

  const result = await db.execute(sql`
    DELETE FROM scans
    WHERE status NOT IN (${statusList})
    AND created_at < ${cutoff}
  `);
  return Number(result.rowCount ?? 0);
}

async function archiveOldAuditLogs(): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_AUDIT_LOGS_DAYS);

  const deleted = await db
    .delete(auditLogs)
    .where(lt(auditLogs.timestamp, cutoffDate))
    .returning({ id: auditLogs.id });

  return deleted.length;
}

export async function getRetentionStats(): Promise<{
  staleResources: number;
  oldFindings: number;
  oldAuditLogs: number;
}> {
  const resourcesCutoff = new Date();
  resourcesCutoff.setDate(resourcesCutoff.getDate() - RETENTION_RESOURCES_DAYS);

  const findingsCutoff = new Date();
  findingsCutoff.setDate(findingsCutoff.getDate() - RETENTION_FINDINGS_DAYS);

  const auditCutoff = new Date();
  auditCutoff.setDate(auditCutoff.getDate() - RETENTION_AUDIT_LOGS_DAYS);

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
    staleResources: Number(staleResourcesResult?.count ?? 0),
    oldFindings: Number(oldFindingsResult?.count ?? 0),
    oldAuditLogs: Number(oldAuditLogsResult?.count ?? 0),
  };
}
