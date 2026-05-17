import { eq, and, sql, inArray } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { resourceDependencies, resources } from '../db/schema.js';
import type { ResourceDependency } from '../db/schema.js';

export interface DependencyWithResource {
  id: string;
  targetResourceId: string;
  targetService: string;
  relationshipType: string;
  createdAt: Date;
  // Resolved target resource info (if exists in our DB)
  targetResource?: {
    id: string;
    name: string | null;
    region: string | null;
    state: string | null;
  };
}

export interface DependentWithResource {
  id: string;
  sourceResourceId: string;
  sourceService: string;
  relationshipType: string;
  createdAt: Date;
  // Source resource info
  sourceResource: {
    id: string;
    resourceId: string;
    name: string | null;
    region: string | null;
    state: string | null;
    service: string;
  };
}

export const dependencyService = {
  /**
   * Get all dependencies (outgoing relationships) for a resource
   */
  async getDependencies(orgId: string, resourceId: string): Promise<DependencyWithResource[]> {
    // Get the resource UUID from the database
    const [resource] = await db
      .select({ id: resources.id })
      .from(resources)
      .where(
        and(
          eq(resources.orgId, orgId),
          eq(resources.id, resourceId)
        )
      )
      .limit(1);

    if (!resource) {
      return [];
    }

    // Get dependencies for this resource
    const deps = await db
      .select({
        id: resourceDependencies.id,
        targetResourceId: resourceDependencies.targetResourceId,
        targetService: resourceDependencies.targetService,
        relationshipType: resourceDependencies.relationshipType,
        createdAt: resourceDependencies.createdAt,
      })
      .from(resourceDependencies)
      .where(
        and(
          eq(resourceDependencies.orgId, orgId),
          eq(resourceDependencies.sourceResourceId, resource.id)
        )
      );

    if (deps.length === 0) return [];

    // Batch-fetch all target resources in a single query instead of N+1
    const targetIds = deps.map(d => d.targetResourceId);
    const targetResources = await db
      .select({
        id: resources.id,
        resourceId: resources.resourceId,
        name: resources.name,
        region: resources.region,
        state: resources.state,
      })
      .from(resources)
      .where(
        and(
          eq(resources.orgId, orgId),
          inArray(resources.resourceId, targetIds)
        )
      );

    const targetMap = new Map(targetResources.map(r => [r.resourceId, r]));

    return deps.map(dep => {
      const target = targetMap.get(dep.targetResourceId);
      return {
        id: dep.id,
        targetResourceId: dep.targetResourceId,
        targetService: dep.targetService,
        relationshipType: dep.relationshipType,
        createdAt: dep.createdAt,
        ...(target ? { targetResource: { id: target.id, name: target.name, region: target.region, state: target.state } } : {}),
      };
    });
  },

  /**
   * Get all dependents (incoming relationships) for a resource
   */
  async getDependents(orgId: string, resourceId: string): Promise<DependentWithResource[]> {
    // Get the resource to find its AWS resource ID
    const [resource] = await db
      .select({ id: resources.id, resourceId: resources.resourceId })
      .from(resources)
      .where(
        and(
          eq(resources.orgId, orgId),
          eq(resources.id, resourceId)
        )
      )
      .limit(1);

    if (!resource) {
      return [];
    }

    // Find all dependencies that reference this resource as target
    const deps = await db
      .select({
        id: resourceDependencies.id,
        sourceResourceId: resourceDependencies.sourceResourceId,
        relationshipType: resourceDependencies.relationshipType,
        createdAt: resourceDependencies.createdAt,
      })
      .from(resourceDependencies)
      .where(
        and(
          eq(resourceDependencies.orgId, orgId),
          eq(resourceDependencies.targetResourceId, resource.resourceId)
        )
      );

    if (deps.length === 0) return [];

    // Batch-fetch all source resources in a single query instead of N+1
    const sourceIds = deps.map(d => d.sourceResourceId);
    const sourceResources = await db
      .select({
        id: resources.id,
        resourceId: resources.resourceId,
        name: resources.name,
        region: resources.region,
        state: resources.state,
        service: resources.service,
      })
      .from(resources)
      .where(inArray(resources.id, sourceIds));

    const sourceMap = new Map(sourceResources.map(r => [r.id, r]));

    return deps
      .filter(dep => sourceMap.has(dep.sourceResourceId))
      .map(dep => {
        const sourceResource = sourceMap.get(dep.sourceResourceId)!;
        return {
          id: dep.id,
          sourceResourceId: dep.sourceResourceId,
          sourceService: sourceResource.service,
          relationshipType: dep.relationshipType,
          createdAt: dep.createdAt,
          sourceResource,
        };
      });
  },

  /**
   * Get all dependencies for an organization (for graph visualization)
   * Limited to 10,000 records to prevent memory issues on large orgs.
   */
  async getAllDependencies(orgId: string): Promise<ResourceDependency[]> {
    return await db
      .select()
      .from(resourceDependencies)
      .where(eq(resourceDependencies.orgId, orgId))
      .limit(10_000);
  },

  /**
   * Get dependency statistics for an organization
   */
  async getDependencyStats(orgId: string) {
    // Count by relationship type
    const byType = await db
      .select({
        relationshipType: resourceDependencies.relationshipType,
        count: sql<number>`count(*)::int`,
      })
      .from(resourceDependencies)
      .where(eq(resourceDependencies.orgId, orgId))
      .groupBy(resourceDependencies.relationshipType);

    // Count by target service
    const byTargetService = await db
      .select({
        targetService: resourceDependencies.targetService,
        count: sql<number>`count(*)::int`,
      })
      .from(resourceDependencies)
      .where(eq(resourceDependencies.orgId, orgId))
      .groupBy(resourceDependencies.targetService);

    // Total count
    const [totalResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(resourceDependencies)
      .where(eq(resourceDependencies.orgId, orgId));

    return {
      totalCount: totalResult?.count ?? 0,
      byType: byType.reduce(
        (acc, item) => ({
          ...acc,
          [item.relationshipType]: item.count,
        }),
        {} as Record<string, number>
      ),
      byTargetService: byTargetService.reduce(
        (acc, item) => ({
          ...acc,
          [item.targetService]: item.count,
        }),
        {} as Record<string, number>
      ),
    };
  },
};
