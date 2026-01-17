import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAwsStore } from "@/stores/aws-store";
import * as api from "@/lib/api";
import type { CreateAwsAccountInput, Scan } from "@/types";
import { useEffect, useRef, useCallback } from "react";

export function useAwsAccounts() {
  const { setAccounts } = useAwsStore();
  const storeAccounts = useAwsStore((state) => state.accounts);
  const queryClient = useQueryClient();
  const prevDataRef = useRef<typeof query.data>(undefined);

  const query = useQuery({
    queryKey: ["aws-accounts"],
    queryFn: api.getAwsAccounts,
  });

  // Sync with store only when data actually changes
  useEffect(() => {
    if (query.data && query.data !== prevDataRef.current) {
      // Only update store if IDs differ (avoid unnecessary updates for same data)
      const newIds = query.data.map(a => a.id).sort().join(',');
      const oldIds = storeAccounts.map(a => a.id).sort().join(',');
      if (newIds !== oldIds || query.data.length !== storeAccounts.length) {
        setAccounts(query.data);
      }
      prevDataRef.current = query.data;
    }
  }, [query.data, setAccounts, storeAccounts]);

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
      // Refresh recent scans list (used by Scans page)
      queryClient.invalidateQueries({ queryKey: ["recent-scans"] });
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
      // Poll every 2 seconds while in any active state
      if (data && ["queued", "processing", "running", "analyzing"].includes(data.status)) {
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

const ACTIVE_STATUSES = ["queued", "processing", "running", "analyzing"];

export function useRecentScans(limit: number = 10, includeArchived: boolean = false) {
  return useQuery({
    queryKey: ["recent-scans", limit, includeArchived],
    queryFn: () => api.getRecentScans(limit, includeArchived),
    refetchInterval: (query) => {
      const data = query.state.data;
      // Poll every 3 seconds if there are active scans
      if (data && data.some(scan => ACTIVE_STATUSES.includes(scan.status))) {
        return 3000;
      }
      // Otherwise poll every 30 seconds
      return 30000;
    },
  });
}

/**
 * Hook that automatically refreshes all relevant data when scans complete.
 * Call this in pages that need to update when scan results are ready.
 */
export function useScanCompletionRefresh() {
  const queryClient = useQueryClient();
  const { data: activeScans } = useActiveScans();
  const prevActiveScansRef = useRef<Scan[] | undefined>(undefined);

  const invalidateAllData = useCallback(() => {
    // Invalidate all data that depends on scan results
    queryClient.invalidateQueries({ queryKey: ["findings"] });
    queryClient.invalidateQueries({ queryKey: ["finding-stats"] });
    queryClient.invalidateQueries({ queryKey: ["resources"] });
    queryClient.invalidateQueries({ queryKey: ["resource-stats"] });
    queryClient.invalidateQueries({ queryKey: ["resource-regions"] });
    queryClient.invalidateQueries({ queryKey: ["resource-services"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["recent-scans"] });
    queryClient.invalidateQueries({ queryKey: ["aws-accounts"] });
    queryClient.invalidateQueries({ queryKey: ["recommended-actions"] });
  }, [queryClient]);

  useEffect(() => {
    const prevScans = prevActiveScansRef.current;

    // Check if any scan just completed (was in prev but not in current)
    if (prevScans && activeScans) {
      const prevIds = new Set(prevScans.map(s => s.id));
      const currentIds = new Set(activeScans.map(s => s.id));

      // If a scan was removed from active scans, it completed
      const completedScanIds = [...prevIds].filter(id => !currentIds.has(id));

      if (completedScanIds.length > 0) {
        // A scan just completed, refresh all data
        invalidateAllData();
      }
    }

    prevActiveScansRef.current = activeScans;
  }, [activeScans, invalidateAllData]);

  return { activeScans, invalidateAllData };
}
