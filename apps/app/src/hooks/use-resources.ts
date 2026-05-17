import { useQuery } from "@tanstack/react-query";
import * as api from "@/lib/api";
import type { ResourceFilters, Resource } from "@/types";

export function useResources(filters?: ResourceFilters, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["resources", filters],
    queryFn: () => api.getResources(filters),
    enabled: options?.enabled ?? true,
  });
}

/**
 * Fetch all resources by paginating through the API.
 * Used for the infrastructure map where we need all resources.
 */
export function useAllResources(filters?: Omit<ResourceFilters, 'page' | 'limit'>, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["all-resources", filters],
    queryFn: async () => {
      const allResources: Resource[] = [];
      let page = 1;
      const limit = 100;
      let hasMore = true;

      while (hasMore) {
        const response = await api.getResources({ ...filters, page, limit });
        allResources.push(...response.data);

        // Check if there are more pages
        const total = response.pagination?.total ?? response.data.length;
        if (response.data.length < limit || allResources.length >= total) {
          hasMore = false;
        } else {
          page++;
        }

        // Safety limit to prevent infinite loops
        if (page > 50) {
          console.warn('Reached maximum page limit for resources');
          hasMore = false;
        }
      }

      return {
        data: allResources,
        truncated: page > 50,
        pagination: {
          total: allResources.length,
          page: 1,
          limit: allResources.length,
          totalPages: 1,
        },
      };
    },
    staleTime: 60000, // Cache for 1 minute
    enabled: options?.enabled ?? true,
  });
}

export function useResource(id: string) {
  return useQuery({
    queryKey: ["resource", id],
    queryFn: () => api.getResource(id),
    enabled: !!id,
  });
}

export function useResourceStats(filters?: { awsAccountId?: string }) {
  return useQuery({
    queryKey: ["resource-stats", filters],
    queryFn: () => api.getResourceStats(filters),
  });
}

export function useResourceRegions() {
  return useQuery({
    queryKey: ["resource-regions"],
    queryFn: api.getDistinctRegions,
  });
}

export function useResourceServices() {
  return useQuery({
    queryKey: ["resource-services"],
    queryFn: api.getDistinctServices,
  });
}

export function useResourceDependencies(resourceId: string) {
  return useQuery({
    queryKey: ["resource-dependencies", resourceId],
    queryFn: () => api.getResourceDependencies(resourceId),
    enabled: !!resourceId,
  });
}

export function useResourceDependents(resourceId: string) {
  return useQuery({
    queryKey: ["resource-dependents", resourceId],
    queryFn: () => api.getResourceDependents(resourceId),
    enabled: !!resourceId,
  });
}

export function useResourceScanHistory(resourceId: string) {
  return useQuery({
    queryKey: ["resource-scan-history", resourceId],
    queryFn: () => api.getResourceScanHistory(resourceId),
    enabled: !!resourceId,
  });
}

export function useAllDependencies(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["all-dependencies"],
    queryFn: () => api.getAllDependencies(),
    staleTime: 60000, // Cache for 1 minute
    enabled: options?.enabled ?? true,
  });
}
