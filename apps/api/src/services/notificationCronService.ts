import { and, eq, gte, inArray, sql } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { redis } from '../lib/redis.js';
import { logger } from '../lib/logger.js';
import { scans, findings, orgWebhooks } from '../db/schema.js';
import { webhookDeliveryService } from './webhookDeliveryService.js';
import { slackService } from './slackService.js';

const POLL_INTERVAL_MS = 60_000;
const LOCK_KEY = 'notif:cron:lock';
const LOCK_TTL = 55; // seconds
const LOOKBACK_MS = 2 * 60 * 1000; // 2 minutes
const DEDUP_TTL = 86400; // 24 hours

export function startNotificationCron(): void {
  logger.info('starting notification cron');
  setInterval(async () => {
    const acquired = await redis.set(LOCK_KEY, '1', 'EX', LOCK_TTL, 'NX');
    if (!acquired) return;
    try {
      await processNotifications();
    } catch (err) {
      logger.error('notification cron error', err as Error);
    }
  }, POLL_INTERVAL_MS);
}

async function processNotifications(): Promise<void> {
  // 1. Find scans completed in last 2 minutes
  const cutoff = new Date(Date.now() - LOOKBACK_MS);
  const completedScans = await db
    .select()
    .from(scans)
    .where(and(
      eq(scans.status, 'complete'),
      gte(scans.completedAt, cutoff),
    ));

  for (const scan of completedScans) {
    // 2. Redis dedup — skip if already processed
    const dedupKey = `notif:scan:${scan.id}`;
    const alreadyProcessed = await redis.set(dedupKey, '1', 'EX', DEDUP_TTL, 'NX');
    if (!alreadyProcessed) continue; // already sent for this scan

    // 3. Dispatch scan.completed to webhooks
    await dispatchScanCompleted(scan);

    // 4. Check for new critical/high findings
    await dispatchNewFindings(scan);
  }
}

async function dispatchScanCompleted(scan: typeof scans.$inferSelect): Promise<void> {
  const activeWebhooks = await db
    .select()
    .from(orgWebhooks)
    .where(and(
      eq(orgWebhooks.orgId, scan.orgId),
      eq(orgWebhooks.isActive, true),
    ));

  const payload = {
    event: 'scan.completed',
    timestamp: new Date().toISOString(),
    data: {
      scanId: scan.id,
      orgId: scan.orgId,
      awsAccountId: scan.awsAccountId,
      status: scan.status,
      resourcesDiscovered: scan.resourcesDiscovered,
      findingsNew: scan.findingsNew,
      findingsResolved: scan.findingsResolved,
      completedAt: scan.completedAt?.toISOString(),
    },
  };

  for (const webhook of activeWebhooks) {
    if (webhook.eventTypes.includes('scan.completed')) {
      await webhookDeliveryService.enqueueDelivery(webhook.id, 'scan.completed', payload);
    }
  }

  try {
    await slackService.sendNotification(scan.orgId, 'scan.completed', payload);
  } catch (err) {
    logger.error('slack notification failed for scan.completed', err as Error);
  }
}

async function dispatchNewFindings(scan: typeof scans.$inferSelect): Promise<void> {
  // Find NEW findings from this scan (firstDetectedAt = lastDetectedAt means brand new)
  const newFindings = await db
    .select()
    .from(findings)
    .where(and(
      eq(findings.orgId, scan.orgId),
      eq(findings.lastScanId, scan.id),
      inArray(findings.severity, ['critical', 'high']),
      sql`${findings.firstDetectedAt} = ${findings.lastDetectedAt}`,
    ));

  if (newFindings.length === 0) return;

  const criticalFindings = newFindings.filter(f => f.severity === 'critical');
  const highFindings = newFindings.filter(f => f.severity === 'high');

  const activeWebhooks = await db
    .select()
    .from(orgWebhooks)
    .where(and(
      eq(orgWebhooks.orgId, scan.orgId),
      eq(orgWebhooks.isActive, true),
    ));

  // Dispatch finding.new_critical
  if (criticalFindings.length > 0) {
    const payload = {
      event: 'finding.new_critical',
      timestamp: new Date().toISOString(),
      data: {
        scanId: scan.id,
        orgId: scan.orgId,
        count: criticalFindings.length,
        findings: criticalFindings.map(f => ({
          id: f.id,
          type: f.type,
          severity: f.severity,
          summary: f.summary,
          resourceId: f.resourceId,
        })),
      },
    };
    for (const webhook of activeWebhooks) {
      if (webhook.eventTypes.includes('finding.new_critical')) {
        await webhookDeliveryService.enqueueDelivery(webhook.id, 'finding.new_critical', payload);
      }
    }

    try {
      await slackService.sendNotification(scan.orgId, 'finding.new_critical', payload);
    } catch (err) {
      logger.error('slack notification failed for finding.new_critical', err as Error);
    }
  }

  // Dispatch finding.new_high
  if (highFindings.length > 0) {
    const payload = {
      event: 'finding.new_high',
      timestamp: new Date().toISOString(),
      data: {
        scanId: scan.id,
        orgId: scan.orgId,
        count: highFindings.length,
        findings: highFindings.map(f => ({
          id: f.id,
          type: f.type,
          severity: f.severity,
          summary: f.summary,
          resourceId: f.resourceId,
        })),
      },
    };
    for (const webhook of activeWebhooks) {
      if (webhook.eventTypes.includes('finding.new_high')) {
        await webhookDeliveryService.enqueueDelivery(webhook.id, 'finding.new_high', payload);
      }
    }

    try {
      await slackService.sendNotification(scan.orgId, 'finding.new_high', payload);
    } catch (err) {
      logger.error('slack notification failed for finding.new_high', err as Error);
    }
  }
}

// Export for testing
export { processNotifications, dispatchScanCompleted, dispatchNewFindings };
