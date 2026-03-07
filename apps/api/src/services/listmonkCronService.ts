import { eq, and, sql, gte, count } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { redis } from '../lib/redis.js';
import { orgs, scans, users, userOrgMembers } from '../db/schema.js';
import { listmonkService } from './listmonkService.js';
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

/** Start the Listmonk polling cron job */
export function startListmonkCron(): void {
  if (!listmonkService.listsConfigured()) {
    logger.info('[ListmonkCron] Lists not configured, skipping');
    return;
  }

  // Run once immediately, then on interval
  processListTransitions();
  setInterval(processListTransitions, POLL_INTERVAL_MS);
  logger.info('[ListmonkCron] Started (60s interval)');
}
