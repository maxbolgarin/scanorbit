import { eq, and, sql } from 'drizzle-orm';
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

    // Try to resolve target resources that exist in our DB
    const result: DependencyWithResource[] = [];
    for (const dep of deps) {
      const depWithResource: DependencyWithResource = {
        id: dep.id,
        targetResourceId: dep.targetResourceId,
        targetService: dep.targetService,
        relationshipType: dep.relationshipType,
        createdAt: dep.createdAt,
      };

      // Try to find the target resource in our DB by AWS resource ID
      const [targetResource] = await db
        .select({
          id: resources.id,
          name: resources.name,
          region: resources.region,
          state: resources.state,
        })
        .from(resources)
        .where(
          and(
            eq(resources.orgId, orgId),
            eq(resources.resourceId, dep.targetResourceId)
          )
        )
        .limit(1);

      if (targetResource) {
        depWithResource.targetResource = targetResource;
      }

      result.push(depWithResource);
    }

    return result;
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

    // Resolve source resources
    const result: DependentWithResource[] = [];
    for (const dep of deps) {
      const [sourceResource] = await db
        .select({
          id: resources.id,
          resourceId: resources.resourceId,
          name: resources.name,
          region: resources.region,
          state: resources.state,
          service: resources.service,
        })
        .from(resources)
        .where(eq(resources.id, dep.sourceResourceId))
        .limit(1);

      if (sourceResource) {
        result.push({
          id: dep.id,
          sourceResourceId: dep.sourceResourceId,
          sourceService: sourceResource.service,
          relationshipType: dep.relationshipType,
          createdAt: dep.createdAt,
          sourceResource,
        });
      }
    }

    return result;
  },

  /**
   * Get all dependencies for an organization (for graph visualization)
   */
  async getAllDependencies(orgId: string): Promise<ResourceDependency[]> {
    return await db
      .select()
      .from(resourceDependencies)
      .where(eq(resourceDependencies.orgId, orgId));
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
