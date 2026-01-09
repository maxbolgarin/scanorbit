import { useQuery } from "@tanstack/react-query";
import * as api from "@/lib/api";
import type { ResourceFilters } from "@/types";

export function useResources(filters?: ResourceFilters) {
  return useQuery({
    queryKey: ["resources", filters],
    queryFn: () => api.getResources(filters),
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
