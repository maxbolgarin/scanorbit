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

export function useResourceRegions() {
  const { data: resources } = useResources();

  const regions = [...new Set(resources?.map((r) => r.region) || [])].sort();

  return regions;
}

export function useResourceServices() {
  const { data: resources } = useResources();

  const services = [...new Set(resources?.map((r) => r.service) || [])].sort();

  return services;
}
