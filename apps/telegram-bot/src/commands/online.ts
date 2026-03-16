import type { CommandContext, Context } from 'grammy';
import { pool } from '../lib/db.js';

export async function onlineCommand(ctx: CommandContext<Context>): Promise<void> {
  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  const res = await pool.query(
    `SELECT DISTINCT u.full_name, u.email
     FROM audit_logs al
     JOIN users u ON al.user_id = u.id
     WHERE al.timestamp >= $1
     ORDER BY u.full_name`,
    [fifteenMinAgo]
  );

  if (res.rows.length === 0) {
    await ctx.reply('<b>Online (15 min)</b>\n\nNo active users', { parse_mode: 'HTML' });
    return;
  }

  const lines = res.rows.map((r: { full_name: string; email: string }) => {
    const name = r.full_name || r.email.split('@')[0];
    return `  ${String(name)}`;
  });

  const text =
    `<b>Online (15 min)</b>\n\n` +
    `${res.rows.length} user${res.rows.length === 1 ? '' : 's'}:\n${ 
    lines.join('\n')}`;

  await ctx.reply(text, { parse_mode: 'HTML' });
}
