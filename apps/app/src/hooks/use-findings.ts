import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import * as api from "@/lib/api";
import type { FindingFilters, FindingStatus } from "@/types";
import { useViewingSettingsStore } from "@/stores/settings-store";

// Helper: Check if a tag exists in existing tags (case-insensitive, non-empty value)
function hasTag(existingTags: Record<string, string>, requiredTag: string): boolean {
  return Object.entries(existingTags).some(
    ([key, value]) => key.toLowerCase() === requiredTag.toLowerCase() && value !== ""
  );
}

// Helper: Calculate which required tags are currently missing based on existing tags
function calculateMissingTags(
  existingTags: Record<string, string> | undefined,
  requiredTags: string[]
): string[] {
  if (!existingTags || requiredTags.length === 0) return [];
  return requiredTags.filter((tag) => !hasTag(existingTags, tag));
}

// Helper: Generate dynamic summary for missing_tag findings based on current settings
function generateMissingTagSummary(
  service: string,
  resourceName: string,
  missingTags: string[]
): string {
  const serviceUpper = service.toUpperCase();
  if (missingTags.length === 1) {
    return `${serviceUpper} '${resourceName}' is missing required tag: ${missingTags[0]}`;
  }
  return `${serviceUpper} '${resourceName}' is missing ${missingTags.length} required tags: ${missingTags.join(", ")}`;
}

export function useFindings(filters?: FindingFilters, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["findings", filters],
    queryFn: () => api.getFindings(filters),
    refetchInterval: 60 * 1000, // Refetch every minute
    enabled: options?.enabled ?? true,
  });
}

/**
 * Hook that returns findings with global viewing filters applied.
 * Use this in place of useFindings when you want to respect org viewing settings.
 */
export function useFilteredFindings(filters?: FindingFilters, options?: { enabled?: boolean }) {
  const query = useFindings(filters, options);
  const settings = useViewingSettingsStore((state) => state.settings);

  const filteredData = useMemo(() => {
    if (!query.data?.data) return undefined;

    // Filter and transform findings
    const filtered = query.data.data
      .filter((finding) => {
        // Hide if type is in hidden list
        if (settings.hiddenFindingTypes.includes(finding.type)) {
          return false;
        }
        // Hide if trivial and hideTrivial is enabled
        if (settings.hideTrivial && finding.severity === "trivial") {
          return false;
        }
        // Multi-type filter (client-side) - used for category filtering like orphaned resources
        if (filters?.types && filters.types.length > 0) {
          if (!filters.types.includes(finding.type)) {
            return false;
          }
        }
        // Dynamic tag filtering for missing_tag findings based on current requiredTags settings
        if (finding.type === "missing_tag" && settings.requiredTags.length > 0) {
          const existingTags = finding.details?.existing_tags as Record<string, string> | undefined;
          const currentlyMissing = calculateMissingTags(existingTags, settings.requiredTags);
          // Hide finding if all required tags are now present (based on current settings)
          if (currentlyMissing.length === 0) {
            return false;
          }
        }
        return true;
      })
      .map((finding) => {
        // Transform missing_tag findings to show dynamic summary based on current settings
        if (finding.type === "missing_tag" && settings.requiredTags.length > 0) {
          const existingTags = finding.details?.existing_tags as Record<string, string> | undefined;
          const currentlyMissing = calculateMissingTags(existingTags, settings.requiredTags);

          if (currentlyMissing.length > 0) {
            const service = (finding.details?.service as string) || "RESOURCE";
            const resourceName = (finding.details?.resource_name as string) || finding.resourceId || "Unknown";

            return {
              ...finding,
              summary: generateMissingTagSummary(service, resourceName, currentlyMissing),
              details: {
                ...finding.details,
                missing_tags: currentlyMissing,
                required_tags: settings.requiredTags,
              },
            };
          }
        }
        return finding;
      });

    return {
      ...query.data,
      data: filtered,
      pagination: {
        ...query.data.pagination,
        total: filtered.length,
        totalPages: Math.ceil(filtered.length / query.data.pagination.limit),
      },
    };
  }, [query.data, settings.hiddenFindingTypes, settings.hideTrivial, settings.requiredTags, filters?.types]);

  return {
    ...query,
    data: filteredData,
    // Also expose unfiltered data for cases where it's needed
    unfilteredData: query.data,
  };
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

export function useRecentActionedFindings(awsAccountId?: string) {
  const baseFilters = { limit: 10, sortBy: "updatedAt" as const, awsAccountId };
  const resolved = useFindings({ ...baseFilters, status: "resolved" });
  const snoozed = useFindings({ ...baseFilters, status: "snoozed" });
  const ignored = useFindings({ ...baseFilters, status: "ignored" });

  const data = useMemo(() => [
    ...(resolved.data?.data ?? []),
    ...(snoozed.data?.data ?? []),
    ...(ignored.data?.data ?? []),
  ], [resolved.data, snoozed.data, ignored.data]);

  return {
    data,
    isLoading: resolved.isLoading || snoozed.isLoading || ignored.isLoading,
  };
}

export function useFindingStats(filters?: { awsAccountId?: string }) {
  return useQuery({
    queryKey: ["finding-stats", filters],
    queryFn: () => api.getFindingStats(filters),
  });
}

/**
 * Hook that returns finding stats with global viewing filters applied.
 * Adjusts the stats to exclude hidden finding types and trivial severity.
 */
export function useFilteredFindingStats(filters?: { awsAccountId?: string }) {
  const query = useFindingStats(filters);
  const settings = useViewingSettingsStore((state) => state.settings);

  const filteredStats = useMemo(() => {
    if (!query.data) return undefined;

    // Filter byType to exclude hidden types
    const filteredByType = Object.fromEntries(
      Object.entries(query.data.byType).filter(
        ([type]) => !settings.hiddenFindingTypes.includes(type as any)
      )
    );

    // Calculate adjusted severity counts
    const filteredBySeverity = { ...query.data.bySeverity };
    const byTypeSeverity = query.data.byTypeSeverity || {};

    // Subtract counts for hidden types from their respective severities
    let hiddenTypeTotal = 0;
    settings.hiddenFindingTypes.forEach((hiddenType) => {
      const severity = byTypeSeverity[hiddenType];
      const count = query.data.byType[hiddenType] || 0;
      hiddenTypeTotal += count;
      if (severity && filteredBySeverity[severity] !== undefined) {
        filteredBySeverity[severity] = Math.max(0, filteredBySeverity[severity] - count);
      }
    });

    // If hideTrivial is enabled, zero out trivial count and track for total adjustment
    let trivialAdjustment = 0;
    if (settings.hideTrivial) {
      trivialAdjustment = filteredBySeverity.trivial || 0;
      filteredBySeverity.trivial = 0;
    }

    // Calculate totalCount - use API value if available, otherwise sum from byType
    const baseTotalCount = query.data.totalCount ?? Object.values(query.data.byType).reduce((sum, c) => sum + c, 0);

    return {
      ...query.data,
      totalCount: Math.max(0, baseTotalCount - hiddenTypeTotal - trivialAdjustment),
      byType: filteredByType,
      bySeverity: filteredBySeverity,
    };
  }, [query.data, settings.hiddenFindingTypes, settings.hideTrivial]);

  return {
    ...query,
    data: filteredStats,
    unfilteredData: query.data,
  };
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

/**
 * Hook to get detection history for a specific finding.
 * Shows when the finding was detected/not detected across scans.
 */
export function useFindingHistory(findingId: string) {
  return useQuery({
    queryKey: ["finding-history", findingId],
    queryFn: () => api.getFindingHistory(findingId),
    enabled: !!findingId,
  });
}

/**
 * Hook to get finding timeline for a specific resource.
 * Shows all findings associated with a resource and their detection history.
 */
export function useResourceFindingTimeline(resourceId: string) {
  return useQuery({
    queryKey: ["resource-finding-timeline", resourceId],
    queryFn: () => api.getResourceFindingTimeline(resourceId),
    enabled: !!resourceId,
  });
}
