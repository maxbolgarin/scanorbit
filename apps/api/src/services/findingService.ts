import { eq, and, desc, count, inArray } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { HTTP400Error, HTTP404Error } from '../lib/errors.js';
import { findings, resources, certificates } from '../db/schema.js';
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
    const data = await db
      .select()
      .from(findings)
      .where(and(...conditions))
      .orderBy(desc(findings.createdAt))
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

    // Get associated resource if exists
    let resource = null;
    if (finding.resourceId) {
      const [r] = await db
        .select()
        .from(resources)
        .where(eq(resources.id, finding.resourceId))
        .limit(1);
      resource = r ?? null;
    }

    // Get associated certificate if exists
    let certificate = null;
    if (finding.certificateId) {
      const [c] = await db
        .select()
        .from(certificates)
        .where(eq(certificates.id, finding.certificateId))
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
    // Get counts by status
    const byStatus = await db
      .select({
        status: findings.status,
        count: count(),
      })
      .from(findings)
      .where(eq(findings.orgId, orgId))
      .groupBy(findings.status);

    // Get counts by severity
    const bySeverity = await db
      .select({
        severity: findings.severity,
        count: count(),
      })
      .from(findings)
      .where(eq(findings.orgId, orgId))
      .groupBy(findings.severity);

    // Get counts by type
    const byType = await db
      .select({
        type: findings.type,
        count: count(),
      })
      .from(findings)
      .where(eq(findings.orgId, orgId))
      .groupBy(findings.type);

    // Get total count
    const [totalResult] = await db
      .select({ count: count() })
      .from(findings)
      .where(eq(findings.orgId, orgId));

    // Get open count
    const [openResult] = await db
      .select({ count: count() })
      .from(findings)
      .where(
        and(
          eq(findings.orgId, orgId),
          eq(findings.status, 'open')
        )
      );

    return {
      total: totalResult?.count ?? 0,
      open: openResult?.count ?? 0,
      byStatus: byStatus.reduce(
        (acc, item) => ({
          ...acc,
          [item.status]: item.count,
        }),
        {} as Record<string, number>
      ),
      bySeverity: bySeverity.reduce(
        (acc, item) => ({
          ...acc,
          [item.severity]: item.count,
        }),
        {} as Record<string, number>
      ),
      byType: byType.reduce(
        (acc, item) => ({
          ...acc,
          [item.type]: item.count,
        }),
        {} as Record<string, number>
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
};
