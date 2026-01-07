import { eq, and, desc, count } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { HTTP404Error } from '../lib/errors.js';
import { resources } from '../db/schema.js';
import type { Resource } from '../db/schema.js';
import type { ResourceFilters, PaginatedResponse } from '../types/index.js';

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

  async getResource(orgId: string, resourceId: string): Promise<Resource> {
    const [resource] = await db
      .select()
      .from(resources)
      .where(
        and(
          eq(resources.id, resourceId),
          eq(resources.orgId, orgId)
        )
      )
      .limit(1);

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

    // Get total count
    const [totalResult] = await db
      .select({ count: count() })
      .from(resources)
      .where(eq(resources.orgId, orgId));

    return {
      total: totalResult?.count ?? 0,
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
