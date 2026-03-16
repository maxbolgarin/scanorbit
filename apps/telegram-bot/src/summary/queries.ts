import { pool } from '../lib/db.js';

export interface SummaryData {
  usersTotal: number;
  usersNewToday: number;
  usersActiveToday: number;
  orgsByTier: Record<string, number>;
  orgsNewToday: number;
  paidOrgs: number;
  trialingOrgs: number;
  estimatedMRR: number;
  scansToday: number;
  scansByStatus: Record<string, number>;
  awsAccountsTotal: number;
  awsAccountsByStatus: Record<string, number>;
  topPaths: Array<{ path: string; count: number }>;
  deadLetterJobs: number;
}

const TIER_PRICES: Record<string, number> = { pro: 19, team: 79 };
const SEAT_PRICE = 10;
const INCLUDED_SEATS = 5;

export async function fetchSummaryData(): Promise<SummaryData> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString();

  const [
    usersTotalRes,
    usersNewRes,
    usersActiveRes,
    tierRes,
    orgsNewRes,
    paidRes,
    trialingRes,
    activeTierRes,
    seatsRes,
    scanStatusRes,
    awsTotalRes,
    awsStatusRes,
    topPathsRes,
    dlqRes,
  ] = await Promise.all([
    pool.query('SELECT count(*) AS cnt FROM users'),
    pool.query('SELECT count(*) AS cnt FROM users WHERE created_at >= $1', [todayISO]),
    pool.query('SELECT count(DISTINCT user_id) AS cnt FROM audit_logs WHERE timestamp >= $1 AND user_id IS NOT NULL', [todayISO]),
    pool.query('SELECT tier, count(*) AS cnt FROM orgs GROUP BY tier'),
    pool.query('SELECT count(*) AS cnt FROM orgs WHERE created_at >= $1', [todayISO]),
    pool.query(`SELECT count(*) AS cnt FROM orgs WHERE subscription_status = 'active'`),
    pool.query(`SELECT count(*) AS cnt FROM orgs WHERE subscription_status = 'trialing'`),
    pool.query(`SELECT tier, count(*) AS cnt FROM orgs WHERE subscription_status = 'active' GROUP BY tier`),
    pool.query(
      `SELECT o.id, o.tier, count(m.id) AS members
       FROM orgs o JOIN user_org_members m ON m.org_id = o.id
       WHERE o.subscription_status = 'active' AND o.tier = 'team'
       GROUP BY o.id, o.tier`
    ),
    pool.query('SELECT status, count(*) AS cnt FROM scans WHERE created_at >= $1 GROUP BY status', [todayISO]),
    pool.query('SELECT count(*) AS cnt FROM aws_accounts'),
    pool.query('SELECT status, count(*) AS cnt FROM aws_accounts GROUP BY status'),
    pool.query(
      `SELECT path, count(*) AS cnt FROM audit_logs
       WHERE timestamp >= $1 AND path NOT IN ('/auth/me', '/health', '/health/ready', '/metrics')
       GROUP BY path ORDER BY cnt DESC LIMIT 5`,
      [todayISO]
    ),
    pool.query('SELECT count(*) AS cnt FROM dead_letter_jobs'),
  ]);

  // Calculate MRR
  let mrr = 0;
  for (const row of activeTierRes.rows) {
    mrr += (TIER_PRICES[row.tier] || 0) * parseInt(row.cnt);
  }
  for (const row of seatsRes.rows) {
    mrr += Math.max(0, parseInt(row.members) - INCLUDED_SEATS) * SEAT_PRICE;
  }

  const orgsByTier: Record<string, number> = {};
  for (const row of tierRes.rows) {
    orgsByTier[row.tier || 'free'] = parseInt(row.cnt);
  }

  const scansByStatus: Record<string, number> = {};
  for (const row of scanStatusRes.rows) {
    scansByStatus[row.status] = parseInt(row.cnt);
  }

  const awsAccountsByStatus: Record<string, number> = {};
  for (const row of awsStatusRes.rows) {
    awsAccountsByStatus[row.status] = parseInt(row.cnt);
  }

  const topPaths = topPathsRes.rows.map((r: { path: string; cnt: string }) => ({
    path: r.path,
    count: parseInt(r.cnt),
  }));

  return {
    usersTotal: parseInt(usersTotalRes.rows[0].cnt),
    usersNewToday: parseInt(usersNewRes.rows[0].cnt),
    usersActiveToday: parseInt(usersActiveRes.rows[0].cnt),
    orgsByTier,
    orgsNewToday: parseInt(orgsNewRes.rows[0].cnt),
    paidOrgs: parseInt(paidRes.rows[0].cnt),
    trialingOrgs: parseInt(trialingRes.rows[0].cnt),
    estimatedMRR: mrr,
    scansToday: Object.values(scansByStatus).reduce((a, b) => a + b, 0),
    scansByStatus,
    awsAccountsTotal: parseInt(awsTotalRes.rows[0].cnt),
    awsAccountsByStatus,
    topPaths,
    deadLetterJobs: parseInt(dlqRes.rows[0].cnt),
  };
}
