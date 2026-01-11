import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "@/lib/api";
import type { FindingFilters, FindingStatus } from "@/types";

export function useFindings(filters?: FindingFilters) {
  return useQuery({
    queryKey: ["findings", filters],
    queryFn: () => api.getFindings(filters),
    refetchInterval: 60 * 1000, // Refetch every minute
  });
}

export function useFinding(id: string) {
  return useQuery({
    queryKey: ["finding", id],
    queryFn: () => api.getFinding(id),
    enabled: !!id,
  });
}

export function useUpdateFindingStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      status,
      snoozedUntil,
    }: {
      id: string;
      status: FindingStatus;
      snoozedUntil?: Date;
    }) => api.updateFindingStatus(id, status, snoozedUntil),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["findings"] });
      queryClient.invalidateQueries({ queryKey: ["finding-stats"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useOpenFindings() {
  const { data } = useFindings({ status: "open" });
  return data?.data || [];
}

export function useFindingStats() {
  return useQuery({
    queryKey: ["finding-stats"],
    queryFn: api.getFindingStats,
  });
}

export function useFindingCounts() {
  const { data: stats } = useFindingStats();

  if (!stats) {
    return {
      total: 0,
      open: 0,
      resolved: 0,
      snoozed: 0,
      ignored: 0,
      high: 0,
      medium: 0,
      low: 0,
    };
  }

  return {
    total: stats.totalCount,
    open: stats.byStatus["open"] || 0,
    resolved: stats.byStatus["resolved"] || 0,
    snoozed: stats.byStatus["snoozed"] || 0,
    ignored: stats.byStatus["ignored"] || 0,
    high: stats.bySeverity["high"] || 0,
    medium: stats.bySeverity["medium"] || 0,
    low: stats.bySeverity["low"] || 0,
  };
}
