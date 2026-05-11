import type { CommandContext, Context } from 'grammy';

export async function helpCommand(ctx: CommandContext<Context>): Promise<void> {
  const text =
    `<b>ScanOrbit Admin Bot</b>\n\n` +
    `/status — Service health (DB, Redis, queues)\n` +
    `/users — User stats (total, new, active)\n` +
    `/orgs — Organizations by tier and status\n` +
    `/scans — Scan stats and recent scans\n` +
    `/online — Users active in last 15 min\n` +
    `/accounts — AWS accounts by status\n` +
    `/revenue — Paid orgs and estimated MRR\n` +
    `/help — Show this message`;

  await ctx.reply(text, { parse_mode: 'HTML' });
}
