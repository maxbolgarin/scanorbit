import type { CommandContext, Context } from 'grammy';
import { pool } from '../lib/db.js';

export async function onlineCommand(ctx: CommandContext<Context>): Promise<void> {
  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  const res = await pool.query(
    `SELECT COUNT(DISTINCT al.user_id) AS count
     FROM audit_logs al
     WHERE al.timestamp >= $1`,
    [fifteenMinAgo]
  );

  const count = Number(res.rows[0]?.count ?? 0);

  if (count === 0) {
    await ctx.reply('<b>Online (15 min)</b>\n\nNo active users', { parse_mode: 'HTML' });
    return;
  }

  const text =
    `<b>Online (15 min)</b>\n\n` +
    `${count} user${count === 1 ? '' : 's'} active`;

  await ctx.reply(text, { parse_mode: 'HTML' });
}
