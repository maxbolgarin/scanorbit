import type { CommandContext, Context } from 'grammy';
import { pool } from '../lib/db.js';
import { redis } from '../lib/redis.js';

const startTime = Date.now();

export async function statusCommand(ctx: CommandContext<Context>): Promise<void> {
  const checks: string[] = [];

  // Database
  try {
    await pool.query('SELECT 1');
    checks.push('DB: OK');
  } catch {
    checks.push('DB: ERROR');
  }

  // Redis
  try {
    await redis.ping();
    checks.push('Redis: OK');
  } catch {
    checks.push('Redis: ERROR');
  }

  // Queue lengths
  const queues = [
    'jobs:scan_account',
    'jobs:analyze_orphans',
    'jobs:analyze_ssl',
    'jobs:analyze_residency',
    'jobs:analyze_security',
    'jobs:analyze_cost',
    'jobs:analyze_tagging',
    'jobs:analyze_iam',
  ];

  let totalQueued = 0;
  for (const q of queues) {
    try {
      totalQueued += await redis.llen(q);
    } catch {
      // ignore
    }
  }

  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
  const uptimeHours = Math.floor(uptimeSeconds / 3600);
  const uptimeMinutes = Math.floor((uptimeSeconds % 3600) / 60);

  const mem = process.memoryUsage();

  const text =
    `<b>Service Status</b>\n\n${ 
    checks.join('\n')  }\n` +
    `Jobs in queue: ${totalQueued}\n` +
    `Bot uptime: ${uptimeHours}h ${uptimeMinutes}m\n` +
    `Memory: ${Math.round(mem.rss / 1024 / 1024)} MB`;

  await ctx.reply(text, { parse_mode: 'HTML' });
}
