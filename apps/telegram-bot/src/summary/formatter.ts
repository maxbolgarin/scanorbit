import type { SummaryData } from './queries.js';

export function formatSummary(data: SummaryData): string {
  const today = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'Europe/Amsterdam',
  });

  const tierLine = Object.entries(data.orgsByTier)
    .map(([tier, count]) => `${tier.toUpperCase()}: ${count}`)
    .join(' | ');

  const scanStatusLine = Object.entries(data.scansByStatus)
    .map(([status, count]) => `${status}: ${count}`)
    .join(', ');

  const awsStatusLine = Object.entries(data.awsAccountsByStatus)
    .map(([status, count]) => `${status}: ${count}`)
    .join(' | ');

  const topPathsLines = data.topPaths
    .map((p) => `  <code>${p.path}</code> — ${p.count}`)
    .join('\n');

  const issues: string[] = [];
  if (data.deadLetterJobs > 0) issues.push(`Dead letter jobs: ${data.deadLetterJobs}`);

  return (
    `<b>Daily Summary — ${today}</b>\n\n` +
    `<b>Users</b>\n` +
    `Total: ${data.usersTotal} | New today: ${data.usersNewToday} | Active today: ${data.usersActiveToday}\n\n` +
    `<b>Organizations</b>\n` +
    `${tierLine}\n` +
    `New today: ${data.orgsNewToday}\n\n` +
    `<b>Revenue</b>\n` +
    `Paid: ${data.paidOrgs} | Trialing: ${data.trialingOrgs}\n` +
    `Est. MRR: $${data.estimatedMRR}\n\n` +
    `<b>Scans</b>\n` +
    `Today: ${data.scansToday}${ 
    scanStatusLine ? ` (${scanStatusLine})` : ''  }\n\n` +
    `<b>AWS Accounts</b>\n` +
    `Total: ${data.awsAccountsTotal}${ 
    awsStatusLine ? ` (${awsStatusLine})` : ''  }\n\n` +
    `<b>Top Activity</b>\n${ 
    topPathsLines || '  No activity yet'  }\n\n${ 
    issues.length > 0
      ? `<b>Issues</b>\n${issues.join('\n')}`
      : 'No issues'}`
  );
}
