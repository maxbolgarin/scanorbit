import { eq, and, desc, count, inArray, sql } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { HTTP400Error, HTTP404Error } from '../lib/errors.js';
import { findings, resources, certificates, findingScans, scans } from '../db/schema.js';
import type { Finding } from '../db/schema.js';
import type { FindingFilters, PaginatedResponse, FindingStatus } from '../types/index.js';

// Valid finding status values
const VALID_STATUSES = ['open', 'resolved', 'snoozed', 'ignored'] as const;

interface UpdateFindingData {
  status?: FindingStatus;
  snoozedUntil?: Date;
}

export const findingService = {
  async getFindings(
    orgId: string,
    filters: FindingFilters
  ): Promise<PaginatedResponse<Finding>> {
    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 50, 100); // Max 100 per page
    const offset = (page - 1) * limit;

    // Build conditions array
    const conditions = [eq(findings.orgId, orgId)];

    if (filters.awsAccountId) {
      conditions.push(eq(findings.awsAccountId, filters.awsAccountId));
    }
    if (filters.resourceId) {
      conditions.push(eq(findings.resourceId, filters.resourceId));
    }
    if (filters.type) {
      conditions.push(eq(findings.type, filters.type));
    }
    if (filters.severity) {
      conditions.push(eq(findings.severity, filters.severity));
    }
    if (filters.status) {
      conditions.push(eq(findings.status, filters.status));
    }

    // Get total count
    const [countResult] = await db
      .select({ count: count() })
      .from(findings)
      .where(and(...conditions));

    const total = countResult?.count ?? 0;

    // Get paginated data
    const orderCol = filters.sortBy === "updatedAt" ? findings.updatedAt : findings.createdAt;
    const data = await db
      .select()
      .from(findings)
      .where(and(...conditions))
      .orderBy(desc(orderCol))
      .limit(limit)
      .offset(offset);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async getFinding(orgId: string, findingId: string) {
    const [finding] = await db
      .select()
      .from(findings)
      .where(
        and(
          eq(findings.id, findingId),
          eq(findings.orgId, orgId)
        )
      )
      .limit(1);

    if (!finding) {
      throw new HTTP404Error('Finding not found');
    }

    // Get associated resource if exists (scoped to org to prevent cross-org data leakage)
    let resource = null;
    if (finding.resourceId) {
      const [r] = await db
        .select()
        .from(resources)
        .where(and(eq(resources.id, finding.resourceId), eq(resources.orgId, orgId)))
        .limit(1);
      resource = r ?? null;
    }

    // Get associated certificate if exists (scoped to org to prevent cross-org data leakage)
    let certificate = null;
    if (finding.certificateId) {
      const [c] = await db
        .select()
        .from(certificates)
        .where(and(eq(certificates.id, finding.certificateId), eq(certificates.orgId, orgId)))
        .limit(1);
      certificate = c ?? null;
    }

    return {
      ...finding,
      resource,
      certificate,
    };
  },

  async updateFinding(
    orgId: string,
    findingId: string,
    data: UpdateFindingData
  ): Promise<Finding> {
    // Validate status transition
    if (data.status) {
      if (!VALID_STATUSES.includes(data.status as typeof VALID_STATUSES[number])) {
        throw new HTTP400Error(`Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`);
      }
    }

    // If snoozing, require snoozedUntil date
    if (data.status === 'snoozed' && !data.snoozedUntil) {
      throw new HTTP400Error('snoozedUntil is required when status is "snoozed"');
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.status) {
      updateData.status = data.status;

      // Set resolvedAt if resolving
      if (data.status === 'resolved') {
        updateData.resolvedAt = new Date();
        updateData.snoozedUntil = null;
      } else if (data.status === 'snoozed') {
        updateData.snoozedUntil = data.snoozedUntil;
        updateData.resolvedAt = null;
      } else if (data.status === 'open') {
        updateData.resolvedAt = null;
        updateData.snoozedUntil = null;
      }
    }

    const [finding] = await db
      .update(findings)
      .set(updateData)
      .where(
        and(
          eq(findings.id, findingId),
          eq(findings.orgId, orgId)
        )
      )
      .returning();

    if (!finding) {
      throw new HTTP404Error('Finding not found');
    }

    return finding;
  },

  async getFindingStats(orgId: string) {
    // Run all 6 queries in parallel instead of sequentially
    const [byStatus, bySeverity, byType, typeSeverities, [totalResult], [openResult]] = await Promise.all([
      // Counts by status
      db.select({ status: findings.status, count: count() })
        .from(findings)
        .where(eq(findings.orgId, orgId))
        .groupBy(findings.status),

      // Counts by severity (only open findings)
      db.select({ severity: findings.severity, count: count() })
        .from(findings)
        .where(and(eq(findings.orgId, orgId), eq(findings.status, 'open')))
        .groupBy(findings.severity),

      // Counts by type (only open findings)
      db.select({ type: findings.type, count: count() })
        .from(findings)
        .where(and(eq(findings.orgId, orgId), eq(findings.status, 'open')))
        .groupBy(findings.type),

      // Severity for each type (for filtering calculations)
      db.selectDistinct({ type: findings.type, severity: findings.severity })
        .from(findings)
        .where(eq(findings.orgId, orgId)),

      // Total count
      db.select({ count: count() })
        .from(findings)
        .where(eq(findings.orgId, orgId)),

      // Open count
      db.select({ count: count() })
        .from(findings)
        .where(and(eq(findings.orgId, orgId), eq(findings.status, 'open'))),
    ]);

    return {
      total: totalResult?.count ?? 0,
      open: openResult?.count ?? 0,
      byStatus: byStatus.reduce(
        (acc, item) => ({ ...acc, [item.status]: item.count }),
        {} as Record<string, number>
      ),
      bySeverity: bySeverity.reduce(
        (acc, item) => ({ ...acc, [item.severity]: item.count }),
        {} as Record<string, number>
      ),
      byType: byType.reduce(
        (acc, item) => ({ ...acc, [item.type]: item.count }),
        {} as Record<string, number>
      ),
      byTypeSeverity: typeSeverities.reduce(
        (acc, item) => {
          const severityPriority: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1, informational: 0 };
          const current = acc[item.type];
          if (!current || (severityPriority[item.severity] ?? 0) > (severityPriority[current] ?? 0)) {
            acc[item.type] = item.severity;
          }
          return acc;
        },
        {} as Record<string, string>
      ),
    };
  },

  async bulkUpdateStatus(
    orgId: string,
    findingIds: string[],
    status: FindingStatus
  ): Promise<number> {
    if (!VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
      throw new HTTP400Error(`Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`);
    }

    const updateData: Record<string, unknown> = {
      status,
      updatedAt: new Date(),
    };

    if (status === 'resolved') {
      updateData.resolvedAt = new Date();
    }

    // Update all findings in a single query (ensuring org ownership)
    const result = await db
      .update(findings)
      .set(updateData)
      .where(
        and(
          inArray(findings.id, findingIds),
          eq(findings.orgId, orgId)
        )
      )
      .returning({ id: findings.id });

    return result.length;
  },

  /**
   * Get detection history for a finding.
   * Returns a list of scans where this finding was detected or not detected.
   */
  async getFindingHistory(orgId: string, findingId: string) {
    // Verify the finding belongs to this org
    const [finding] = await db
      .select({ id: findings.id })
      .from(findings)
      .where(
        and(
          eq(findings.id, findingId),
          eq(findings.orgId, orgId)
        )
      )
      .limit(1);

    if (!finding) {
      throw new HTTP404Error('Finding not found');
    }

    // Get detection history with scan info
    const history = await db
      .select({
        id: findingScans.id,
        findingId: findingScans.findingId,
        scanId: findingScans.scanId,
        status: findingScans.status,
        createdAt: findingScans.createdAt,
        scan: {
          id: scans.id,
          status: scans.status,
          startedAt: scans.startedAt,
          completedAt: scans.completedAt,
          resourcesDiscovered: scans.resourcesDiscovered,
        },
      })
      .from(findingScans)
      .innerJoin(scans, eq(findingScans.scanId, scans.id))
      .where(eq(findingScans.findingId, findingId))
      .orderBy(desc(findingScans.createdAt));

    return history;
  },

  /**
   * Get finding timeline for a specific resource.
   * Shows all findings and their detection history for that resource.
   */
  async getResourceFindingTimeline(orgId: string, resourceId: string) {
    // Get all findings for this resource
    const resourceFindings = await db
      .select()
      .from(findings)
      .where(
        and(
          eq(findings.resourceId, resourceId),
          eq(findings.orgId, orgId)
        )
      )
      .orderBy(desc(findings.firstDetectedAt));

    if (resourceFindings.length === 0) {
      return [];
    }

    // Fetch all detection history in a single query (avoids N+1)
    const findingIds = resourceFindings.map((f) => f.id);
    const allHistory = await db
      .select({
        id: findingScans.id,
        findingId: findingScans.findingId,
        status: findingScans.status,
        createdAt: findingScans.createdAt,
        scan: {
          id: scans.id,
          completedAt: scans.completedAt,
        },
      })
      .from(findingScans)
      .innerJoin(scans, eq(findingScans.scanId, scans.id))
      .where(inArray(findingScans.findingId, findingIds))
      .orderBy(desc(findingScans.createdAt));

    // Group history by finding ID (application-level grouping)
    const historyByFindingId = new Map<string, typeof allHistory>();
    for (const record of allHistory) {
      const list = historyByFindingId.get(record.findingId) ?? [];
      if (list.length < 10) { // Limit history per finding
        list.push(record);
      }
      historyByFindingId.set(record.findingId, list);
    }

    return resourceFindings.map((finding) => ({
      finding,
      detectionHistory: historyByFindingId.get(finding.id) ?? [],
    }));
  },

  /**
   * Get resource health based on findings.
   * This calculates how many resources are healthy, warning, or critical based on their findings.
   * Available to all tiers (doesn't expose finding details).
   */
  async getResourceHealth(
    orgId: string,
    awsAccountId?: string
  ): Promise<{ total: number; healthy: number; warning: number; critical: number; orphaned: number }> {
    // Build conditions for resources
    const resourceConditions = [eq(resources.orgId, orgId)];
    if (awsAccountId) {
      resourceConditions.push(eq(resources.awsAccountId, awsAccountId));
    }

    // Get total resource count
    const [totalResult] = await db
      .select({ count: count() })
      .from(resources)
      .where(and(...resourceConditions));
    const total = totalResult?.count ?? 0;

    // Build conditions for findings
    const findingConditions = [
      eq(findings.orgId, orgId),
      eq(findings.status, 'open'),
    ];
    if (awsAccountId) {
      findingConditions.push(eq(findings.awsAccountId, awsAccountId));
    }

    // Orphaned/unused/idle finding types (all from the orphans analyzer)
    const orphanedTypes = [
      'orphaned_volume',
      'orphaned_eip',
      'orphaned_snapshot',
      'orphaned_eni',
      'idle_load_balancer',
      'unused_security_group',
      'idle_nat_gateway',
    ];

    // Single query to classify each resource by its worst finding category:
    // orphaned > critical > warning, using CASE/WHEN with priority
    const healthCategories = await db
      .select({
        resourceId: findings.resourceId,
        category: sql<string>`
          CASE
            WHEN bool_or(${findings.type} IN (${sql.join(orphanedTypes.map(t => sql`${t}`), sql`, `)})) THEN 'orphaned'
            WHEN bool_or(${findings.severity} = 'critical') THEN 'critical'
            ELSE 'warning'
          END
        `.as('category'),
      })
      .from(findings)
      .where(
        and(
          ...findingConditions,
          sql`${findings.resourceId} IS NOT NULL`
        )
      )
      .groupBy(findings.resourceId);

    let orphaned = 0;
    let critical = 0;
    let warning = 0;
    for (const row of healthCategories) {
      if (row.category === 'orphaned') orphaned++;
      else if (row.category === 'critical') critical++;
      else warning++;
    }
    const healthy = Math.max(0, total - critical - warning - orphaned);

    return {
      total,
      healthy,
      warning,
      critical,
      orphaned,
    };
  },
};
