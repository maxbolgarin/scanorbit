import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { useViewingSettingsStore } from "@/stores/settings-store";
import * as api from "@/lib/api";
import type { OrgSettings } from "@/types";

/**
 * Hook for managing organization viewing settings.
 * Syncs settings between the server and local Zustand store.
 */
export function useOrgSettings() {
  const queryClient = useQueryClient();
  const org = useAuthStore((state) => state.org);
  const {
    settings: storeSettings,
    setSettings,
    setLoading,
    lastSyncedOrgId,
    setLastSyncedOrgId,
  } = useViewingSettingsStore();

  const prevDataRef = useRef<OrgSettings | undefined>(undefined);

  // Query for fetching settings
  const query = useQuery({
    queryKey: ["org-settings", org?.id],
    queryFn: () => api.getOrgSettings(org!.id),
    enabled: !!org?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Sync with store when data changes or when org changes
  useEffect(() => {
    if (query.data && query.data !== prevDataRef.current) {
      setSettings(query.data);
      setLastSyncedOrgId(org?.id || null);
      prevDataRef.current = query.data;
    }
  }, [query.data, setSettings, setLastSyncedOrgId, org?.id]);

  // Reset and refetch when org changes
  useEffect(() => {
    if (org?.id && org.id !== lastSyncedOrgId) {
      // Org changed, need to fetch fresh settings
      queryClient.invalidateQueries({ queryKey: ["org-settings", org.id] });
    }
  }, [org?.id, lastSyncedOrgId, queryClient]);

  // Update loading state
  useEffect(() => {
    setLoading(query.isLoading);
  }, [query.isLoading, setLoading]);

  // Mutation for updating settings
  const updateMutation = useMutation({
    mutationFn: (updates: Partial<OrgSettings>) =>
      api.updateOrgSettings(org!.id, updates),
    onSuccess: (data) => {
      // Update local store immediately
      setSettings(data);
      // Invalidate query to ensure consistency
      queryClient.invalidateQueries({ queryKey: ["org-settings", org?.id] });
    },
  });

  return {
    // Current settings (from store for immediate access, or from query)
    settings: storeSettings,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,

    // Update function
    updateSettings: (updates: Partial<OrgSettings>) =>
      updateMutation.mutateAsync(updates),
    isUpdating: updateMutation.isPending,
    updateError: updateMutation.error,

    // Helper functions from store
    isTypeHidden: useViewingSettingsStore((state) => state.isTypeHidden),
    shouldHideFinding: useViewingSettingsStore((state) => state.shouldHideFinding),
    getVisibleFindings: useViewingSettingsStore((state) => state.getVisibleFindings),
  };
}

/**
 * Lightweight hook for just reading settings (no mutations).
 * Use this in components that only need to filter findings.
 */
export function useViewingSettings() {
  return useViewingSettingsStore((state) => ({
    settings: state.settings,
    isTypeHidden: state.isTypeHidden,
    shouldHideFinding: state.shouldHideFinding,
    getVisibleFindings: state.getVisibleFindings,
  }));
}
