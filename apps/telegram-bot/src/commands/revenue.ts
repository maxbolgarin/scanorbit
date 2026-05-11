import type { CommandContext, Context } from 'grammy';
import { pool } from '../lib/db.js';

// Pricing from SubscriptionSettings.tsx
const TIER_PRICES: Record<string, number> = {
  pro: 19,
  team: 79,
};
const SEAT_PRICE = 10;
const INCLUDED_SEATS = 5;

export async function revenueCommand(ctx: CommandContext<Context>): Promise<void> {
  const [paidRes, trialingRes, tierRes, seatsRes] = await Promise.all([
    pool.query(
      `SELECT count(*) AS cnt FROM orgs WHERE subscription_status = 'active'`
    ),
    pool.query(
      `SELECT count(*) AS cnt FROM orgs WHERE subscription_status = 'trialing'`
    ),
    pool.query(
      `SELECT tier, count(*) AS cnt FROM orgs WHERE subscription_status = 'active' GROUP BY tier`
    ),
    // Count members per paid org for seat-based billing
    pool.query(
      `SELECT o.id, o.tier, count(m.id) AS members
       FROM orgs o
       JOIN user_org_members m ON m.org_id = o.id
       WHERE o.subscription_status = 'active' AND o.tier = 'team'
       GROUP BY o.id, o.tier`
    ),
  ]);

  // Calculate MRR from tier subscriptions
  let mrr = 0;
  for (const row of tierRes.rows) {
    const price = TIER_PRICES[row.tier] || 0;
    mrr += price * parseInt(row.cnt);
  }

  // Add seat-based revenue for team orgs
  for (const row of seatsRes.rows) {
    const extraSeats = Math.max(0, parseInt(row.members) - INCLUDED_SEATS);
    mrr += extraSeats * SEAT_PRICE;
  }

  const text =
    `<b>Revenue</b>\n\n` +
    `Active subscriptions: ${paidRes.rows[0].cnt}\n` +
    `Trialing: ${trialingRes.rows[0].cnt}\n` +
    `Estimated MRR: $${mrr}\n\n` +
    `<i>PRO $19/mo, TEAM $79/mo, +$10/seat after 5</i>`;

  await ctx.reply(text, { parse_mode: 'HTML' });
}
