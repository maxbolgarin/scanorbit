import type { CommandContext, Context } from 'grammy';
import { pool } from '../lib/db.js';

export async function accountsCommand(ctx: CommandContext<Context>): Promise<void> {
  const [totalRes, statusRes] = await Promise.all([
    pool.query('SELECT count(*) AS cnt FROM aws_accounts'),
    pool.query('SELECT status, count(*) AS cnt FROM aws_accounts GROUP BY status ORDER BY status'),
  ]);

  const byStatus = statusRes.rows.map((r: { status: string; cnt: string }) => `${r.status}: ${r.cnt}`).join(' | ');

  const text =
    `<b>AWS Accounts</b>\n\n` +
    `Total: ${totalRes.rows[0].cnt}\n` +
    `By status: ${byStatus || 'none'}`;

  await ctx.reply(text, { parse_mode: 'HTML' });
}
