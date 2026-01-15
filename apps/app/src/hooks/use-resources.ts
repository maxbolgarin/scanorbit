import { useQuery } from "@tanstack/react-query";
import * as api from "@/lib/api";
import type { ResourceFilters, Resource } from "@/types";

export function useResources(filters?: ResourceFilters) {
  return useQuery({
    queryKey: ["resources", filters],
    queryFn: () => api.getResources(filters),
  });
}

/**
 * Fetch all resources by paginating through the API.
 * Used for the infrastructure map where we need all resources.
 */
export function useAllResources(filters?: Omit<ResourceFilters, 'page' | 'limit'>) {
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
        pagination: {
          total: allResources.length,
          page: 1,
          limit: allResources.length,
          totalPages: 1,
        },
      };
    },
    staleTime: 60000, // Cache for 1 minute
  });
}

export function useResource(id: string) {
  return useQuery({
    queryKey: ["resource", id],
    queryFn: () => api.getResource(id),
    enabled: !!id,
  });
}

export function useResourceStats() {
  return useQuery({
    queryKey: ["resource-stats"],
    queryFn: api.getResourceStats,
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
