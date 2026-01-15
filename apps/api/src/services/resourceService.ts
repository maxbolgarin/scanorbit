import { eq, and, desc, count, inArray, sql } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { HTTP404Error } from '../lib/errors.js';
import { resources } from '../db/schema.js';
import type { Resource } from '../db/schema.js';
import type { ResourceFilters, PaginatedResponse } from '../types/index.js';

// Service categorization for cost filtering
const FREE_SERVICES = ['iam_user', 'iam_role', 'iam_policy', 'iam_access_key', 'security_group'];
const PAID_SERVICES = [
  'ec2', 'ebs', 'eip', 'rds', 'rds_snapshot', 's3', 'alb', 'acm',
  'lambda', 'cloudwatch_logs', 'cloudwatch_alarm', 'secret', 'kms_key'
];

interface UpdateTagsData {
  tags: Record<string, string>;
}

export const resourceService = {
  async getResources(
    orgId: string,
    filters: ResourceFilters
  ): Promise<PaginatedResponse<Resource>> {
    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 50, 100); // Max 100 per page
    const offset = (page - 1) * limit;

    // Build conditions array
    const conditions = [eq(resources.orgId, orgId)];

    if (filters.awsAccountId) {
      conditions.push(eq(resources.awsAccountId, filters.awsAccountId));
    }
    if (filters.region) {
      conditions.push(eq(resources.region, filters.region));
    }
    if (filters.service) {
      conditions.push(eq(resources.service, filters.service));
    }
    if (filters.state) {
      conditions.push(eq(resources.state, filters.state));
    }

    // Cost filter
    if (filters.costFilter === 'paid') {
      conditions.push(inArray(resources.service, PAID_SERVICES));
    } else if (filters.costFilter === 'free') {
      conditions.push(inArray(resources.service, FREE_SERVICES));
    }

    // Get total count
    const [countResult] = await db
      .select({ count: count() })
      .from(resources)
      .where(and(...conditions));

    const total = countResult?.count ?? 0;

    // Get paginated data
    const data = await db
      .select()
      .from(resources)
      .where(and(...conditions))
      .orderBy(desc(resources.lastSeenAt))
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

  async getResource(orgId: string, id: string): Promise<Resource> {
    // Check if id is a valid UUID format
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    let resource: Resource | undefined;

    if (isUuid) {
      // Try lookup by database UUID first
      [resource] = await db
        .select()
        .from(resources)
        .where(
          and(
            eq(resources.id, id),
            eq(resources.orgId, orgId)
          )
        )
        .limit(1);
    }

    // If not found by UUID (or not a UUID), try lookup by AWS resource ID
    if (!resource) {
      [resource] = await db
        .select()
        .from(resources)
        .where(
          and(
            eq(resources.resourceId, id),
            eq(resources.orgId, orgId)
          )
        )
        .limit(1);
    }

    if (!resource) {
      throw new HTTP404Error('Resource not found');
    }

    return resource;
  },

  async updateResourceTags(
    orgId: string,
    resourceId: string,
    data: UpdateTagsData
  ): Promise<Resource> {
    const [resource] = await db
      .update(resources)
      .set({
        tags: data.tags,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(resources.id, resourceId),
          eq(resources.orgId, orgId)
        )
      )
      .returning();

    if (!resource) {
      throw new HTTP404Error('Resource not found');
    }

    return resource;
  },

  async getResourceStats(orgId: string) {
    // Get counts by service
    const byService = await db
      .select({
        service: resources.service,
        count: count(),
      })
      .from(resources)
      .where(eq(resources.orgId, orgId))
      .groupBy(resources.service);

    // Get counts by region
    const byRegion = await db
      .select({
        region: resources.region,
        count: count(),
      })
      .from(resources)
      .where(eq(resources.orgId, orgId))
      .groupBy(resources.region);

    // Get counts by state
    const byState = await db
      .select({
        state: resources.state,
        count: count(),
      })
      .from(resources)
      .where(eq(resources.orgId, orgId))
      .groupBy(resources.state);

    // Get total count
    const [totalResult] = await db
      .select({ count: count() })
      .from(resources)
      .where(eq(resources.orgId, orgId));

    // Get cost aggregation for paid services only
    const costByService = await db
      .select({
        service: resources.service,
        totalCost: sql<string>`SUM(COALESCE(${resources.costEstimateMonthly}, 0))`.as('total_cost'),
        count: count(),
      })
      .from(resources)
      .where(
        and(
          eq(resources.orgId, orgId),
          inArray(resources.service, PAID_SERVICES)
        )
      )
      .groupBy(resources.service);

    return {
      totalCount: totalResult?.count ?? 0,
      byService: byService.reduce(
        (acc, item) => ({
          ...acc,
          [item.service]: item.count,
        }),
        {} as Record<string, number>
      ),
      byRegion: byRegion.reduce(
        (acc, item) => ({
          ...acc,
          [item.region ?? 'unknown']: item.count,
        }),
        {} as Record<string, number>
      ),
      byState: byState.reduce(
        (acc, item) => ({
          ...acc,
          [item.state ?? 'unknown']: item.count,
        }),
        {} as Record<string, number>
      ),
      costByService: costByService.reduce(
        (acc, item) => ({
          ...acc,
          [item.service]: {
            count: item.count,
            totalCost: parseFloat(item.totalCost || '0'),
          },
        }),
        {} as Record<string, { count: number; totalCost: number }>
      ),
    };
  },

  async getDistinctRegions(orgId: string): Promise<string[]> {
    const result = await db
      .selectDistinct({ region: resources.region })
      .from(resources)
      .where(eq(resources.orgId, orgId));

    return result
      .map((r) => r.region)
      .filter((r): r is string => r !== null);
  },

  async getDistinctServices(orgId: string): Promise<string[]> {
    const result = await db
      .selectDistinct({ service: resources.service })
      .from(resources)
      .where(eq(resources.orgId, orgId));

    return result.map((r) => r.service);
  },
};
