import { db } from '../lib/db.js';
import { jobs, scans, deadLetterJobs } from '../db/schema.js';
import { eq, and, lt, inArray } from 'drizzle-orm';
import { logger } from '../lib/logger.js';
import { ACTIVE_SCAN_STATUSES, ScanStatus } from '../types/index.js';

// Jobs running longer than this are considered stuck
const STUCK_JOB_TIMEOUT_MINUTES = 30;
// Maximum recovery attempts before moving to dead letter queue
const MAX_RECOVERY_COUNT = 3;

interface StuckJobResult {
  stuckJobsRecovered: number;
  stuckScansErrored: number;
  jobsMovedToDLQ: number;
  errors: string[];
}

/**
 * Recover stuck jobs and scans that have been in active state too long.
 *
 * This handles cases where:
 * - A Go worker crashed mid-scan, leaving jobs in "running" state
 * - A job was picked up but never completed
 * - A scan is in an active state with no corresponding running job
 */
export async function recoverStuckJobs(): Promise<StuckJobResult> {
  const result: StuckJobResult = {
    stuckJobsRecovered: 0,
    stuckScansErrored: 0,
    jobsMovedToDLQ: 0,
    errors: [],
  };

  const cutoff = new Date(Date.now() - STUCK_JOB_TIMEOUT_MINUTES * 60 * 1000);

  try {
    // 1. Find jobs stuck in "running" state past the timeout
    const stuckRunningJobs = await db
      .select({
        id: jobs.id,
        scanId: jobs.scanId,
        type: jobs.type,
        payload: jobs.payload,
        recoveryCount: jobs.recoveryCount,
        startedAt: jobs.startedAt,
      })
      .from(jobs)
      .where(
        and(
          eq(jobs.status, 'running'),
          lt(jobs.startedAt, cutoff)
        )
      );

    for (const job of stuckRunningJobs) {
      try {
        if (job.recoveryCount >= MAX_RECOVERY_COUNT) {
          // Move to dead letter queue - this job has failed too many times
          await db.insert(deadLetterJobs).values({
            jobId: job.id,
            jobType: job.type,
            payload: job.payload as Record<string, unknown>,
            error: `Job stuck in running state ${job.recoveryCount + 1} times. Last started at ${job.startedAt?.toISOString()}`,
            retries: job.recoveryCount,
          });

          // Mark the job as error
          await db
            .update(jobs)
            .set({
              status: 'error',
              error: `Moved to dead letter queue after ${job.recoveryCount} recovery attempts`,
              completedAt: new Date(),
            })
            .where(eq(jobs.id, job.id));

          // Mark the associated scan as error
          if (job.scanId) {
            await db
              .update(scans)
              .set({
                status: ScanStatus.ERROR,
                errorMessage: 'Scan failed: worker processing timed out after multiple retries',
                completedAt: new Date(),
              })
              .where(
                and(
                  eq(scans.id, job.scanId),
                  inArray(scans.status, ACTIVE_SCAN_STATUSES)
                )
              );
            result.stuckScansErrored++;
          }

          result.jobsMovedToDLQ++;
          logger.warn('Job moved to dead letter queue', {
            jobId: job.id,
            jobType: job.type,
            recoveryCount: job.recoveryCount,
          });
        } else {
          // Reset to queued for retry, increment recovery count
          await db
            .update(jobs)
            .set({
              status: 'queued',
              startedAt: null,
              error: null,
              recoveryCount: job.recoveryCount + 1,
            })
            .where(eq(jobs.id, job.id));

          // Reset scan status to queued as well
          if (job.scanId) {
            await db
              .update(scans)
              .set({ status: ScanStatus.QUEUED })
              .where(
                and(
                  eq(scans.id, job.scanId),
                  inArray(scans.status, ACTIVE_SCAN_STATUSES)
                )
              );
          }

          result.stuckJobsRecovered++;
          logger.info('Stuck job recovered', {
            jobId: job.id,
            jobType: job.type,
            recoveryCount: job.recoveryCount + 1,
          });
        }
      } catch (err) {
        result.errors.push(`Failed to recover job ${job.id}: ${(err as Error).message}`);
        logger.error('Failed to recover stuck job', err as Error, { jobId: job.id });
      }
    }

    // 2. Find scans stuck in active state with no corresponding active job
    //    (orphaned scans where job was already completed/errored or deleted)
    const orphanedScans = await db
      .select({ id: scans.id, status: scans.status, createdAt: scans.createdAt })
      .from(scans)
      .where(
        and(
          inArray(scans.status, ACTIVE_SCAN_STATUSES),
          lt(scans.createdAt, cutoff)
        )
      );

    for (const scan of orphanedScans) {
      // Check if there's any active job for this scan
      const [activeJob] = await db
        .select({ id: jobs.id })
        .from(jobs)
        .where(
          and(
            eq(jobs.scanId, scan.id),
            inArray(jobs.status, ['queued', 'running'])
          )
        )
        .limit(1);

      if (!activeJob) {
        // No active job exists - mark scan as error
        try {
          await db
            .update(scans)
            .set({
              status: ScanStatus.ERROR,
              errorMessage: 'Scan abandoned: no active worker processing this scan',
              completedAt: new Date(),
            })
            .where(eq(scans.id, scan.id));

          result.stuckScansErrored++;
          logger.warn('Orphaned scan marked as error', {
            scanId: scan.id,
            previousStatus: scan.status,
          });
        } catch (err) {
          result.errors.push(`Failed to error orphaned scan ${scan.id}: ${(err as Error).message}`);
        }
      }
    }
  } catch (err) {
    result.errors.push(`Fatal error in stuck job recovery: ${(err as Error).message}`);
    logger.error('Fatal error in stuck job recovery', err as Error);
  }

  return result;
}
