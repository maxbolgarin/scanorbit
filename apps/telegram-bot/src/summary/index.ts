import { redis } from '../lib/redis.js';
import { sendAdminMessage } from '../lib/telegram.js';
import { config } from '../lib/config.js';
import { logger } from '../lib/logger.js';
import { fetchSummaryData } from './queries.js';
import { formatSummary } from './formatter.js';

async function runSummary(): Promise<void> {
  // Check if it's the target hour in CET
  const now = new Date();
  const cetHour = parseInt(
    new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'Europe/Amsterdam' }).format(now),
  );

  if (cetHour !== config.summaryHourCET) return;

  // Prevent double-runs within the same day
  const todayKey = `telegram:summary:ran:${now.toISOString().slice(0, 10)}`;
  const alreadyRan = await redis.set(todayKey, '1', 'EX', 86400, 'NX');
  if (!alreadyRan) return;

  logger.info('[Summary] Running daily summary');

  try {
    const data = await fetchSummaryData();
    const message = formatSummary(data);
    await sendAdminMessage(message);
    logger.info('[Summary] Daily summary sent');
  } catch (err) {
    logger.error('[Summary] Failed to send daily summary', err);
  }
}

export function startSummaryCron(): void {
  const safeRun = async () => {
    try {
      await runSummary();
    } catch (err) {
      logger.error('[Summary] Unhandled error in summary tick', err);
    }
  };

  setInterval(safeRun, config.pollIntervalMs);
  logger.info(`[Summary] Cron started (checks every 60s, runs at ${config.summaryHourCET}:00 CET)`);
}
