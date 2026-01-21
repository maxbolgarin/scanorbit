import { useQuery } from "@tanstack/react-query";
import * as api from "@/lib/api";
import { useViewingSettingsStore } from "@/stores/settings-store";

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
  // Get hidden finding types from settings store
  const hiddenFindingTypes = useViewingSettingsStore(
    (state) => state.settings.hiddenFindingTypes
  );
  const hideTrivial = useViewingSettingsStore(
    (state) => state.settings.hideTrivial
  );

  const query = useQuery({
    // Include hidden types in query key for cache invalidation when settings change
    queryKey: ["dashboard", "enhanced-summary", filters, hiddenFindingTypes, hideTrivial],
    queryFn: () => api.getEnhancedDashboardSummary({
      ...filters,
      hiddenFindingTypes,
    }),
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
