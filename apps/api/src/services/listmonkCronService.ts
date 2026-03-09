import { eq, and, sql, gte, count } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { redis } from '../lib/redis.js';
import { orgs, scans, users, userOrgMembers, findings } from '../db/schema.js';
import { listmonkService } from './listmonkService.js';
import { sendImmediate } from './dripSchedulerService.js';
import { logger } from '../lib/logger.js';
import { ScanStatus } from '../types/index.js';

const POLL_INTERVAL_MS = 60_000; // 1 minute
const LOOKBACK_MS = 2 * 60_000; // 2 minutes (overlap window to avoid misses)

const REDIS_KEY_FIRST_SCAN = 'listmonk:processed:first-scan';
const REDIS_KEY_TRIAL_ACTIVE = 'listmonk:processed:trial-active';

/** Get admin email for an org */
async function getAdminEmail(orgId: string): Promise<string | null> {
  const [admin] = await db
    .select({ email: users.email })
    .from(users)
    .innerJoin(userOrgMembers, eq(users.id, userOrgMembers.userId))
    .where(and(eq(userOrgMembers.orgId, orgId), eq(userOrgMembers.role, 'admin')))
    .limit(1);

  return admin?.email ?? null;
}

/**
 * Detect free-tier orgs that just completed their first scan.
 * Moves subscriber from free-new → free-scanned.
 */
async function processFirstScanCompletions(): Promise<void> {
  const lookbackTime = new Date(Date.now() - LOOKBACK_MS);

  // Find orgs with tier='free' that have exactly 1 completed scan finished recently
  const results = await db
    .select({
      orgId: scans.orgId,
      scanId: scans.id,
    })
    .from(scans)
    .innerJoin(orgs, eq(scans.orgId, orgs.id))
    .where(
      and(
        eq(orgs.tier, 'free'),
        eq(scans.status, ScanStatus.COMPLETE),
        gte(scans.completedAt, lookbackTime),
      )
    );

  for (const row of results) {
    // Check if already processed
    const alreadyProcessed = await redis.sismember(REDIS_KEY_FIRST_SCAN, row.scanId);
    if (alreadyProcessed) continue;

    // Verify this is actually the org's first completed scan
    const [scanCount] = await db
      .select({ total: count() })
      .from(scans)
      .where(
        and(
          eq(scans.orgId, row.orgId),
          eq(scans.status, ScanStatus.COMPLETE),
        )
      );

    if ((scanCount?.total ?? 0) !== 1) continue;

    const email = await getAdminEmail(row.orgId);
    if (!email) continue;

    await listmonkService.onFirstScanComplete(email);
    await redis.sadd(REDIS_KEY_FIRST_SCAN, row.scanId);
    logger.info('[ListmonkCron] Processed first scan completion', { orgId: row.orgId });

    // Store scan stats as subscriber attributes and send day-0 drip email
    try {
      const severityCounts = await db
        .select({ severity: findings.severity, total: count() })
        .from(findings)
        .where(and(eq(findings.orgId, row.orgId), eq(findings.status, 'open')))
        .groupBy(findings.severity);

      const stats: Record<string, number> = { high: 0, medium: 0, low: 0 };
      for (const s of severityCounts) {
        stats[s.severity] = Number(s.total);
      }
      const totalFindings = Object.values(stats).reduce((a, b) => a + b, 0);

      const scanData = {
        scan_completed_at: new Date().toISOString(),
        high_count: stats.high,
        medium_count: stats.medium,
        low_count: stats.low,
        total_findings: totalFindings,
      };

      await listmonkService.updateAttribsByEmail(email, scanData);
      sendImmediate({ sequenceName: 'free-scanned', email, data: scanData }).catch((err) => logger.warn('listmonk: failed sendImmediate for free-scanned', { error: (err as Error).message }));
    } catch (attribErr) {
      logger.warn('[ListmonkCron] Failed to store scan stats or send drip', {
        error: (attribErr as Error).message,
      });
    }
  }
}

/**
 * Detect trial orgs with 2+ completed scans.
 * Moves subscriber from trial-new → trial-active.
 */
async function processTrialActiveTransitions(): Promise<void> {
  // Find trialing orgs with 2+ completed scans
  const results = await db
    .select({
      orgId: orgs.id,
      scanCount: count(scans.id),
    })
    .from(orgs)
    .innerJoin(scans, eq(orgs.id, scans.orgId))
    .where(
      and(
        eq(orgs.subscriptionStatus, 'trialing'),
        eq(scans.status, ScanStatus.COMPLETE),
      )
    )
    .groupBy(orgs.id)
    .having(sql`count(${scans.id}) >= 2`);

  for (const row of results) {
    // Check if already processed
    const alreadyProcessed = await redis.sismember(REDIS_KEY_TRIAL_ACTIVE, row.orgId);
    if (alreadyProcessed) continue;

    const email = await getAdminEmail(row.orgId);
    if (!email) continue;

    await listmonkService.onTrialActive(email);
    await redis.sadd(REDIS_KEY_TRIAL_ACTIVE, row.orgId);
    logger.info('[ListmonkCron] Processed trial-active transition', { orgId: row.orgId });
  }
}

async function processListTransitions(): Promise<void> {
  try {
    await processFirstScanCompletions();
    await processTrialActiveTransitions();
  } catch (error) {
    logger.error('[ListmonkCron] Error processing list transitions', error as Error);
  }
}

const REDIS_LOCK_KEY = 'listmonk:cron:lock';
const LOCK_TTL_SECONDS = 55; // Slightly less than poll interval to prevent overlap

/** Start the Listmonk polling cron job */
export function startListmonkCron(): void {
  if (!listmonkService.listsConfigured()) {
    logger.info('[ListmonkCron] Lists not configured, skipping');
    return;
  }

  // Wrapper with distributed lock and error handling
  const safeProcessListTransitions = async (): Promise<void> => {
    try {
      // Acquire distributed lock to prevent duplicate execution across instances
      const acquired = await redis.set(REDIS_LOCK_KEY, '1', 'EX', LOCK_TTL_SECONDS, 'NX');
      if (!acquired) return;

      await processListTransitions();
    } catch (error) {
      logger.error('[ListmonkCron] Unhandled error in cron tick', error as Error);
    }
  };

  // Run once immediately, then on interval
  safeProcessListTransitions();
  setInterval(safeProcessListTransitions, POLL_INTERVAL_MS);
  logger.info('[ListmonkCron] Started (60s interval)');
}
