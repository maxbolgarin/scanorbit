import { useQuery } from "@tanstack/react-query";
import * as api from "@/lib/api";

interface DashboardFilters {
  awsAccountId?: string;
}

export function useDashboardSummary(filters?: DashboardFilters) {
  return useQuery({
    queryKey: ["dashboard", "summary", filters],
    queryFn: () => api.getDashboardSummary(filters),
    refetchInterval: 60 * 1000, // Refetch every minute
  });
}

export function useEnhancedDashboardSummary(filters?: DashboardFilters) {
  const query = useQuery({
    queryKey: ["dashboard", "enhanced-summary", filters],
    queryFn: () => api.getEnhancedDashboardSummary(filters),
    refetchInterval: 60 * 1000, // Refetch every minute
    retry: 1,
  });

  // Log errors for debugging
  if (query.error) {
    console.error("Enhanced dashboard summary error:", query.error);
  }

  return query;
}

export function useRecommendedActions(filters?: DashboardFilters) {
  return useQuery({
    queryKey: ["dashboard", "actions", filters],
    queryFn: () => api.getRecommendedActions(filters),
  });
}
