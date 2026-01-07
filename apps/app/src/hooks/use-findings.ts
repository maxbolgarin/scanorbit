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
      snoozeDays,
    }: {
      id: string;
      status: FindingStatus;
      snoozeDays?: number;
    }) => api.updateFindingStatus(id, status, snoozeDays),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["findings"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useOpenFindings() {
  const { data: findings } = useFindings({ status: "open" });
  return findings || [];
}

export function useFindingCounts() {
  const { data: findings } = useFindings();

  if (!findings) {
    return {
      total: 0,
      open: 0,
      resolved: 0,
      snoozed: 0,
      high: 0,
      medium: 0,
      low: 0,
    };
  }

  return {
    total: findings.length,
    open: findings.filter((f) => f.status === "open").length,
    resolved: findings.filter((f) => f.status === "resolved").length,
    snoozed: findings.filter((f) => f.status === "snoozed").length,
    high: findings.filter((f) => f.severity === "high" && f.status === "open").length,
    medium: findings.filter((f) => f.severity === "medium" && f.status === "open").length,
    low: findings.filter((f) => f.severity === "low" && f.status === "open").length,
  };
}
