import { eq } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { redis } from '../lib/redis.js';
import { logger } from '../lib/logger.js';
import { notificationPreferences, users, orgs } from '../db/schema.js';
import { digestService } from './digestService.js';
import { emailService } from './emailService.js';
import { buildDigestEmailHtml, buildDigestEmailText } from '../emails/digestEmail.js';
import { config } from '../lib/config.js';
import { ne } from 'drizzle-orm';

const POLL_INTERVAL_MS = 3_600_000; // 1 hour
const LOCK_KEY = 'digest:cron:lock';
const LOCK_TTL = 3500; // slightly less than 1 hour
const DEDUP_TTL = 86400; // 24h

export function startDigestCron(): void {
  logger.info('starting digest cron');
  setInterval(async () => {
    const acquired = await redis.set(LOCK_KEY, '1', 'EX', LOCK_TTL, 'NX');
    if (!acquired) return;
    try {
      await processDigests();
    } catch (err) {
      logger.error('digest cron error', err as Error);
    }
  }, POLL_INTERVAL_MS);
}

export async function processDigests(): Promise<void> {
  // Get all preferences where digest is not off
  const prefs = await db
    .select()
    .from(notificationPreferences)
    .where(ne(notificationPreferences.digestFrequency, 'off'));

  const now = new Date();

  for (const pref of prefs) {
    try {
      // Check if it's 9 AM in user's timezone
      const userHour = getHourInTimezone(now, pref.timezone);
      if (userHour !== 9) continue;

      // Weekly: only on Monday
      if (pref.digestFrequency === 'weekly') {
        const userDay = getDayInTimezone(now, pref.timezone);
        if (userDay !== 1) continue; // 1 = Monday
      }

      // Redis dedup
      const dateStr = now.toISOString().slice(0, 10);
      const dedupKey = `digest:sent:${pref.userId}:${dateStr}`;
      const fresh = await redis.set(dedupKey, '1', 'EX', DEDUP_TTL, 'NX');
      if (!fresh) continue;

      // Get user and org info
      const [user] = await db.select().from(users).where(eq(users.id, pref.userId)).limit(1);
      const [org] = await db.select().from(orgs).where(eq(orgs.id, pref.orgId)).limit(1);
      if (!user || !org) continue;

      // Aggregate digest
      const periodDays = pref.digestFrequency === 'daily' ? 1 : 7;
      const digestData = await digestService.aggregateDigest(pref.orgId, periodDays);

      // Skip if no findings activity
      if (digestData.newFindings === 0 && digestData.resolvedFindings === 0 && digestData.scansRun === 0) continue;

      // Build and send email
      const period = pref.digestFrequency === 'daily' ? 'Daily' : 'Weekly';
      const dashboardUrl = `${config.frontendUrl}/overview`;
      const html = buildDigestEmailHtml(org.name, digestData, period, dashboardUrl);
      const text = buildDigestEmailText(org.name, digestData, period, dashboardUrl);

      await emailService.sendDigestEmail({
        to: user.email,
        subject: `${period} ScanOrbit Digest — ${org.name}`,
        html,
        text,
      });

      logger.info('digest email sent', { userId: pref.userId, orgId: pref.orgId, frequency: pref.digestFrequency });
    } catch (err) {
      logger.error('failed to send digest', err as Error, { userId: pref.userId, orgId: pref.orgId });
    }
  }
}

export function getHourInTimezone(date: Date, timezone: string): number {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: timezone });
    return parseInt(formatter.format(date), 10);
  } catch {
    return date.getUTCHours(); // fallback to UTC
  }
}

export function getDayInTimezone(date: Date, timezone: string): number {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: timezone });
    const day = formatter.format(date);
    const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return dayMap[day] ?? date.getUTCDay();
  } catch {
    return date.getUTCDay();
  }
}
