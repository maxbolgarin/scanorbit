import type { CommandContext, Context } from 'grammy';
import { pool } from '../lib/db.js';

export async function orgsCommand(ctx: CommandContext<Context>): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString();

  const [tierRes, statusRes, newRes] = await Promise.all([
    pool.query('SELECT tier, count(*) AS cnt FROM orgs GROUP BY tier ORDER BY tier'),
    pool.query('SELECT subscription_status, count(*) AS cnt FROM orgs GROUP BY subscription_status ORDER BY subscription_status'),
    pool.query('SELECT count(*) AS cnt FROM orgs WHERE created_at >= $1', [todayISO]),
  ]);

  const tiers = tierRes.rows.map((r: { tier: string; cnt: string }) => `${(r.tier || 'free').toUpperCase()}: ${r.cnt}`).join(' | ');
  const statuses = statusRes.rows.map((r: { subscription_status: string; cnt: string }) => `${r.subscription_status || 'none'}: ${r.cnt}`).join(', ');

  const text =
    `<b>Organizations</b>\n\n` +
    `By tier: ${tiers}\n` +
    `New today: ${newRes.rows[0].cnt}\n\n` +
    `<b>Subscription status</b>\n${statuses}`;

  await ctx.reply(text, { parse_mode: 'HTML' });
}
