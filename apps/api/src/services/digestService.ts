import { and, eq, gte, sql, count } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { findings, scans, resources } from '../db/schema.js';
import { logger } from '../lib/logger.js';

export interface DigestData {
  findingsBySeverity: { critical: number; high: number; medium: number; low: number; trivial: number };
  newFindings: number;
  resolvedFindings: number;
  topActionableItems: Array<{
    id: string;
    type: string;
    severity: string;
    summary: string;
    resourceId: string | null;
  }>;
  estimatedCostSavings: number;
  scansRun: number;
}

export const digestService = {
  async aggregateDigest(orgId: string, periodDays: number): Promise<DigestData> {
    const cutoff = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

    // New findings in period, grouped by severity
    const severityCounts = await db
      .select({
        severity: findings.severity,
        count: count(),
      })
      .from(findings)
      .where(and(
        eq(findings.orgId, orgId),
        eq(findings.status, 'open'),
        gte(findings.createdAt, cutoff),
      ))
      .groupBy(findings.severity);

    const findingsBySeverity = { critical: 0, high: 0, medium: 0, low: 0, trivial: 0 };
    let newFindings = 0;
    for (const row of severityCounts) {
      findingsBySeverity[row.severity as keyof typeof findingsBySeverity] = Number(row.count);
      newFindings += Number(row.count);
    }

    // Resolved findings in period
    const [resolvedResult] = await db
      .select({ count: count() })
      .from(findings)
      .where(and(
        eq(findings.orgId, orgId),
        eq(findings.status, 'resolved'),
        gte(findings.resolvedAt, cutoff),
      ));
    const resolvedFindings = Number(resolvedResult?.count ?? 0);

    // Top 5 actionable open findings (by severity priority)
    const severityOrder = sql`CASE ${findings.severity}
      WHEN 'critical' THEN 1
      WHEN 'high' THEN 2
      WHEN 'medium' THEN 3
      WHEN 'low' THEN 4
      WHEN 'trivial' THEN 5
      END`;

    const topItems = await db
      .select({
        id: findings.id,
        type: findings.type,
        severity: findings.severity,
        summary: findings.summary,
        resourceId: findings.resourceId,
      })
      .from(findings)
      .where(and(
        eq(findings.orgId, orgId),
        eq(findings.status, 'open'),
      ))
      .orderBy(severityOrder)
      .limit(5);

    // Estimated cost savings from cost-type findings
    // Cost-type finding types: 'unused_resource', 'stopped_instance', 'ebs_optimization', 'old_gen_instance', 'oversized_lambda', 'log_retention', 'unused_kms_key', 'rds_optimization', 'old_gen_rds'
    const costTypes = ['unused_resource', 'stopped_instance', 'ebs_optimization', 'old_gen_instance', 'oversized_lambda', 'log_retention', 'unused_kms_key', 'rds_optimization', 'old_gen_rds'];

    // Sum costEstimateMonthly from resources that have open cost findings
    const [costResult] = await db
      .select({ total: sql<string>`COALESCE(SUM(${resources.costEstimateMonthly}), 0)` })
      .from(findings)
      .innerJoin(resources, eq(findings.resourceId, resources.id))
      .where(and(
        eq(findings.orgId, orgId),
        eq(findings.status, 'open'),
        sql`${findings.type} = ANY(${costTypes})`,
      ));
    const estimatedCostSavings = parseFloat(costResult?.total ?? '0');

    // Scans run in period
    const [scanResult] = await db
      .select({ count: count() })
      .from(scans)
      .where(and(
        eq(scans.orgId, orgId),
        gte(scans.completedAt, cutoff),
      ));
    const scansRun = Number(scanResult?.count ?? 0);

    logger.debug('digest aggregated', { orgId, periodDays, newFindings, resolvedFindings, scansRun });

    return {
      findingsBySeverity,
      newFindings,
      resolvedFindings,
      topActionableItems: topItems,
      estimatedCostSavings,
      scansRun,
    };
  },
};
