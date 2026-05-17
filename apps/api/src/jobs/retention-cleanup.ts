/**
 * Data Retention Cleanup & Stuck Job Recovery
 *
 * Daily cleanup driven by configured TTLs:
 * - Delete stale resources (RETENTION_RESOURCES_DAYS)
 * - Delete resolved findings (RETENTION_FINDINGS_RESOLVED_DAYS)
 * - Delete old scan records (RETENTION_SCANS_DAYS)
 * - Delete old audit logs (RETENTION_AUDIT_LOGS_DAYS)
 * - Recover stuck jobs and orphaned scans
 *
 * Run manually: npx tsx src/jobs/retention-cleanup.ts
 * Run via cron: 0 3 * * * cd /app && node dist/jobs/retention-cleanup.js
 */

import { runRetentionCleanup, getRetentionStats } from '../services/retentionService.js';
import { recoverStuckJobs } from '../services/stuckJobService.js';
import { db } from '../lib/db.js';
import { auditLogs } from '../db/schema.js';
import { logger } from '../lib/logger.js';

const jobLogger = logger.child({ job: 'retention-cleanup' });

async function main() {
  jobLogger.info('Data retention cleanup & stuck job recovery started');

  let hasErrors = false;

  try {
    // 1. Recover stuck jobs first (time-sensitive)
    jobLogger.info('Recovering stuck jobs and orphaned scans...');
    const recoveryResult = await recoverStuckJobs();
    jobLogger.info('Recovery result', { result: recoveryResult });
    if (recoveryResult.errors.length > 0) {
      jobLogger.error('Recovery errors', undefined, { errors: recoveryResult.errors });
      hasErrors = true;
    }

    // 2. Get stats before cleanup
    const beforeStats = await getRetentionStats();
    jobLogger.info('Stats before cleanup', { stats: beforeStats });

    // 3. Run retention cleanup
    jobLogger.info('Running retention cleanup...');
    const result = await runRetentionCleanup();

    // Log results
    jobLogger.info('Cleanup completed', { result });

    // Log to audit table
    await db.insert(auditLogs).values({
      action: 'retention_cleanup',
    });

    // Get stats after cleanup
    const afterStats = await getRetentionStats();
    jobLogger.info('Stats after cleanup', { stats: afterStats });

    if (result.errors.length > 0) {
      jobLogger.error('Cleanup errors', undefined, { errors: result.errors });
      hasErrors = true;
    }

    jobLogger.info(hasErrors ? 'Job completed with errors' : 'Job completed successfully');

    process.exit(hasErrors ? 1 : 0);
  } catch (err) {
    jobLogger.fatal('Job failed with error', err);
    process.exit(1);
  }
}

main();
