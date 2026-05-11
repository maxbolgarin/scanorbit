import type { CommandContext, Context } from 'grammy';
import { pool } from '../lib/db.js';

export async function scansCommand(ctx: CommandContext<Context>): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString();

  const [statusRes, recentRes] = await Promise.all([
    pool.query(
      'SELECT status, count(*) AS cnt FROM scans WHERE created_at >= $1 GROUP BY status ORDER BY cnt DESC',
      [todayISO]
    ),
    pool.query(
      `SELECT s.id, s.status, s.resources_discovered, s.created_at, s.org_id
       FROM scans s
       ORDER BY s.created_at DESC
       LIMIT 5`
    ),
  ]);

  const totalToday = statusRes.rows.reduce((sum: number, r: { cnt: string }) => sum + parseInt(r.cnt), 0);
  const byStatus = statusRes.rows.map((r: { status: string; cnt: string }) => `${r.status}: ${r.cnt}`).join(', ');

  let recentLines = '';
  for (const scan of recentRes.rows) {
    const time = new Date(scan.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' });
    const resources = scan.resources_discovered != null ? ` (${scan.resources_discovered} resources)` : '';
    const orgShort = scan.org_id?.slice(0, 8) || '???';
    recentLines += `  ${time} <code>${orgShort}</code> — ${scan.status}${resources}\n`;
  }

  const text =
    `<b>Scans</b>\n\n` +
    `Today: ${totalToday}\n${ 
    byStatus ? `Status: ${byStatus}\n` : '' 
    }\n<b>Recent scans</b>\n${ 
    recentLines || '  No scans yet'}`;

  await ctx.reply(text, { parse_mode: 'HTML' });
}
