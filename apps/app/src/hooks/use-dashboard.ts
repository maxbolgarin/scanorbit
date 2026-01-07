import { useQuery } from "@tanstack/react-query";
import * as api from "@/lib/api";

export function useDashboardSummary() {
  return useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: api.getDashboardSummary,
    refetchInterval: 60 * 1000, // Refetch every minute
  });
}

export function useRecommendedActions() {
  return useQuery({
    queryKey: ["dashboard", "actions"],
    queryFn: api.getRecommendedActions,
  });
}
