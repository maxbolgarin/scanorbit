import type { CommandContext, Context } from 'grammy';
import { pool } from '../lib/db.js';

export async function usersCommand(ctx: CommandContext<Context>): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString();

  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Monday
  const weekISO = weekStart.toISOString();

  const [totalRes, newTodayRes, newWeekRes, activeRes] = await Promise.all([
    pool.query('SELECT count(*) AS cnt FROM users'),
    pool.query('SELECT count(*) AS cnt FROM users WHERE created_at >= $1', [todayISO]),
    pool.query('SELECT count(*) AS cnt FROM users WHERE created_at >= $1', [weekISO]),
    pool.query(
      'SELECT count(DISTINCT user_id) AS cnt FROM audit_logs WHERE timestamp >= $1 AND user_id IS NOT NULL',
      [todayISO]
    ),
  ]);

  const text =
    `<b>Users</b>\n\n` +
    `Total: ${totalRes.rows[0].cnt}\n` +
    `New today: ${newTodayRes.rows[0].cnt}\n` +
    `New this week: ${newWeekRes.rows[0].cnt}\n` +
    `Active today: ${activeRes.rows[0].cnt}`;

  await ctx.reply(text, { parse_mode: 'HTML' });
}
