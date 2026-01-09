import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAwsStore } from "@/stores/aws-store";
import * as api from "@/lib/api";
import type { CreateAwsAccountInput } from "@/types";
import { useEffect } from "react";

export function useAwsAccounts() {
  const { setAccounts } = useAwsStore();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["aws-accounts"],
    queryFn: api.getAwsAccounts,
  });

  // Sync with store
  useEffect(() => {
    if (query.data) {
      setAccounts(query.data);
    }
  }, [query.data, setAccounts]);

  const createMutation = useMutation({
    mutationFn: api.createAwsAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aws-accounts"] });
    },
  });

  const testConnectionMutation = useMutation({
    mutationFn: (accountId: string) => api.testAwsConnection(accountId),
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteAwsAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aws-accounts"] });
    },
  });

  return {
    accounts: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    createAccount: (input: CreateAwsAccountInput) => createMutation.mutateAsync(input),
    testConnection: (accountId: string) => testConnectionMutation.mutateAsync(accountId),
    deleteAccount: (accountId: string) => deleteMutation.mutateAsync(accountId),
    isCreating: createMutation.isPending,
    isTesting: testConnectionMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

export function useAwsAccount(id: string) {
  return useQuery({
    queryKey: ["aws-account", id],
    queryFn: () => api.getAwsAccount(id),
    enabled: !!id,
  });
}

export function useScanHistory(accountId: string) {
  return useQuery({
    queryKey: ["scan-history", accountId],
    queryFn: () => api.getScanHistory(accountId),
    enabled: !!accountId,
  });
}

export function useTriggerScan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.triggerScan,
    onSuccess: (_data, accountId) => {
      queryClient.invalidateQueries({ queryKey: ["scan-history", accountId] });
      queryClient.invalidateQueries({ queryKey: ["aws-accounts"] });
      // Immediately refresh active scans to show the new scan
      queryClient.invalidateQueries({ queryKey: ["active-scans"] });
    },
  });
}

export function useScanStatus(scanId: string | null) {
  return useQuery({
    queryKey: ["scan-status", scanId],
    queryFn: () => api.getScan(scanId!),
    enabled: !!scanId,
    refetchInterval: (query) => {
      const data = query.state.data;
      // Poll every 2 seconds while running
      if (data && data.status === "running") {
        return 2000;
      }
      return false;
    },
  });
}

export function useActiveScans() {
  return useQuery({
    queryKey: ["active-scans"],
    queryFn: api.getActiveScans,
    refetchInterval: (query) => {
      const data = query.state.data;
      // Poll every 3 seconds if there are active scans
      if (data && data.length > 0) {
        return 3000;
      }
      // Poll every 10 seconds when no active scans
      return 10000;
    },
  });
}

export function useRecentScans(limit: number = 10) {
  return useQuery({
    queryKey: ["recent-scans", limit],
    queryFn: () => api.getRecentScans(limit),
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}
