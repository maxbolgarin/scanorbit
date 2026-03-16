import { pool } from '../lib/db.js';
import { redis } from '../lib/redis.js';
import { sendAdminMessage } from '../lib/telegram.js';
import { config } from '../lib/config.js';
import { logger } from '../lib/logger.js';

async function checkScanCompletions(): Promise<void> {
  const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();

  const res = await pool.query(
    `SELECT s.id, s.status, s.resources_discovered, s.resources_delta,
            s.findings_new, s.findings_resolved, s.error_message, s.completed_at,
            a.name AS account_name, o.name AS org_name
     FROM scans s
     JOIN aws_accounts a ON s.aws_account_id = a.id
     JOIN orgs o ON s.org_id = o.id
     WHERE s.completed_at >= $1
       AND s.status IN ('complete', 'partial', 'error')`,
    [twoMinAgo]
  );

  for (const scan of res.rows) {
    const dedupKey = `telegram:scan:notified:${scan.id}`;
    const isNew = await redis.set(dedupKey, '1', 'EX', 86400, 'NX');
    if (!isNew) continue;

    let text: string;
    if (scan.status === 'error') {
      text =
        `<b>Scan Failed</b>\n` +
        `Org: ${escapeHtml(scan.org_name)}\n` +
        `Account: ${escapeHtml(scan.account_name)}\n` +
        `Error: ${escapeHtml(scan.error_message || 'Unknown')}`;
    } else {
      const delta = scan.resources_delta != null ? ` (${scan.resources_delta >= 0 ? '+' : ''}${scan.resources_delta})` : '';
      text =
        `<b>Scan ${scan.status === 'complete' ? 'Completed' : 'Partial'}</b>\n` +
        `Org: ${escapeHtml(scan.org_name)}\n` +
        `Account: ${escapeHtml(scan.account_name)}\n` +
        `Resources: ${scan.resources_discovered ?? 0}${delta}`;

      if (scan.findings_new > 0 || scan.findings_resolved > 0) {
        text += `\nFindings: +${scan.findings_new ?? 0} new, -${scan.findings_resolved ?? 0} resolved`;
      }
    }

    await sendAdminMessage(text);
  }
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function startScanCompletionPolling(): void {
  const safeRun = async () => {
    try {
      await checkScanCompletions();
    } catch (err) {
      logger.error('[ScanPoll] Error checking scan completions', err);
    }
  };

  setInterval(safeRun, config.pollIntervalMs);
  logger.info('[ScanPoll] Scan completion polling started (every 60s)');
}
