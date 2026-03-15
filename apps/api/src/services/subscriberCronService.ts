/**
 * Subscriber lifecycle cron job.
 * Detects list transitions and fires day-0 emails.
 *
 * - processFirstScanCompletions: free-new → free-scanned
 * - processTrialActiveTransitions: trial-new → trial-active
 * - cleanupExpiredTrialActive: trial-active → subscribers
 */

import { eq, and, sql, gte, count, inArray } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { redis } from '../lib/redis.js';
import { orgs, scans, users, userOrgMembers, findings } from '../db/schema.js';
import { subscriberService } from './subscriberService.js';
import { sendImmediate } from './dripSchedulerService.js';
import { logger } from '../lib/logger.js';
import { ScanStatus } from '../types/index.js';

const POLL_INTERVAL_MS = 60_000; // 1 minute
const LOOKBACK_MS = 2 * 60_000; // 2 minutes (overlap window to avoid misses)

const REDIS_KEY_FIRST_SCAN = 'subscriber:processed:first-scan';
const REDIS_KEY_TRIAL_ACTIVE = 'subscriber:processed:trial-active';
const DEDUP_TTL_SECONDS = 30 * 86_400; // 30 days

/** Get admin email and name for an org */
async function getAdminEmail(orgId: string): Promise<{ email: string; name: string | null } | null> {
  const [admin] = await db
    .select({ email: users.email, fullName: users.fullName })
    .from(users)
    .innerJoin(userOrgMembers, eq(users.id, userOrgMembers.userId))
    .where(and(eq(userOrgMembers.orgId, orgId), eq(userOrgMembers.role, 'admin')))
    .limit(1);

  return admin ? { email: admin.email, name: admin.fullName } : null;
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
    const alreadyProcessed = await redis.get(`${REDIS_KEY_FIRST_SCAN}:${row.scanId}`);
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

    const admin = await getAdminEmail(row.orgId);
    if (!admin) continue;

    await subscriberService.onFirstScanComplete(admin.email);
    await redis.set(`${REDIS_KEY_FIRST_SCAN}:${row.scanId}`, '1', 'EX', DEDUP_TTL_SECONDS);
    logger.info('[SubscriberCron] Processed first scan completion', { orgId: row.orgId });

    // Store scan stats as subscriber attributes and send day-0 drip email
    try {
      const severityCounts = await db
        .select({ severity: findings.severity, total: count() })
        .from(findings)
        .where(and(eq(findings.orgId, row.orgId), eq(findings.status, 'open')))
        .groupBy(findings.severity);

      const stats: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
      for (const s of severityCounts) {
        stats[s.severity] = Number(s.total);
      }
      const totalFindings = Object.values(stats).reduce((a, b) => a + b, 0);

      const COST_FINDING_TYPES = [
        'orphaned_volume', 'orphaned_eip', 'orphaned_snapshot',
        'unused_resource', 'stopped_instance', 'unused_log_group',
      ];
      const [costCount] = await db
        .select({ total: count() })
        .from(findings)
        .where(and(
          eq(findings.orgId, row.orgId),
          eq(findings.status, 'open'),
          inArray(findings.type, COST_FINDING_TYPES),
        ));

      const scanData = {
        scan_completed_at: new Date().toISOString(),
        critical_count: stats.critical,
        high_count: stats.high,
        medium_count: stats.medium,
        low_count: stats.low,
        total_findings: totalFindings,
        cost_count: Number(costCount?.total ?? 0),
      };

      await subscriberService.updateAttribsByEmail(admin.email, scanData);
      sendImmediate({ sequenceName: 'free-scanned', email: admin.email, name: admin.name, data: scanData }).catch((err) => logger.warn('subscriber: failed sendImmediate for free-scanned', { error: (err as Error).message }));
    } catch (attribErr) {
      logger.warn('[SubscriberCron] Failed to store scan stats or send drip', {
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
    const alreadyProcessed = await redis.get(`${REDIS_KEY_TRIAL_ACTIVE}:${row.orgId}`);
    if (alreadyProcessed) continue;

    const admin = await getAdminEmail(row.orgId);
    if (!admin) continue;

    await subscriberService.onTrialActive(admin.email);
    await redis.set(`${REDIS_KEY_TRIAL_ACTIVE}:${row.orgId}`, '1', 'EX', DEDUP_TTL_SECONDS);
    logger.info('[SubscriberCron] Processed trial-active transition', { orgId: row.orgId });
  }
}

async function processListTransitions(): Promise<void> {
  try {
    await processFirstScanCompletions();
    await processTrialActiveTransitions();
    await subscriberService.cleanupExpiredTrialActive();
  } catch (error) {
    logger.error('[SubscriberCron] Error processing list transitions', error as Error);
  }
}

const REDIS_LOCK_KEY = 'subscriber:cron:lock';
const LOCK_TTL_SECONDS = 55; // Slightly less than poll interval to prevent overlap

/** Start the subscriber polling cron job */
export function startSubscriberCron(): void {
  if (!subscriberService.isConfigured()) {
    logger.info('[SubscriberCron] Resend not configured, skipping');
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
      logger.error('[SubscriberCron] Unhandled error in cron tick', error as Error);
    }
  };

  // Run once immediately, then on interval
  safeProcessListTransitions();
  setInterval(safeProcessListTransitions, POLL_INTERVAL_MS);
  logger.info('[SubscriberCron] Started (60s interval)');
}
