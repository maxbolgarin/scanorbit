import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { FindingFiltersAdvanced } from "@/components/findings/FindingFiltersAdvanced";
import { FindingsTableAdvanced } from "@/components/findings/FindingsTableAdvanced";
import { FindingStatsCards } from "@/components/findings/FindingStatsCards";
import { FindingDetailModal } from "@/components/findings/FindingDetailModal";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import {
  useFindings,
  useUpdateFindingStatus,
  useFindingStats,
} from "@/hooks/use-findings";
import { toast } from "@/hooks/use-toast";
import type { FindingFilters as Filters, Finding, FindingStatus } from "@/types";
import { AlertTriangle, RefreshCw, BarChart3 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function Findings() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState<Filters>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
  const [showStats, setShowStats] = useState(true);

  const { data: findingsResponse, isLoading, isFetching } = useFindings(filters);
  const allFindings = findingsResponse?.data || [];
  const { data: stats, isLoading: statsLoading } = useFindingStats();
  const updateStatus = useUpdateFindingStatus();

  // Client-side search filter
  const filteredFindings = useMemo(() => {
    if (!searchQuery.trim()) return allFindings;

    const query = searchQuery.toLowerCase();
    return allFindings.filter(
      (finding) =>
        finding.summary.toLowerCase().includes(query) ||
        finding.type.toLowerCase().includes(query)
    );
  }, [allFindings, searchQuery]);

  // Handle URL parameter for opening finding detail
  useEffect(() => {
    const findingId = searchParams.get("id");
    if (findingId && allFindings.length > 0) {
      const finding = allFindings.find((f) => f.id === findingId);
      if (finding) {
        setSelectedFinding(finding);
      }
    }
  }, [searchParams, allFindings]);

  const handleSelectFinding = (finding: Finding) => {
    setSelectedFinding(finding);
    setSearchParams({ id: finding.id });
  };

  const handleCloseModal = () => {
    setSelectedFinding(null);
    setSearchParams({});
  };

  const handleUpdateStatus = async (
    id: string,
    status: FindingStatus,
    snoozedUntil?: Date
  ) => {
    try {
      await updateStatus.mutateAsync({ id, status, snoozedUntil });
      toast({
        title: "Finding updated",
        description: `Finding marked as ${status}`,
        type: "success",
      });
      handleCloseModal();
    } catch {
      toast({
        title: "Update failed",
        description: "Failed to update finding status",
        type: "error",
      });
    }
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["findings"] });
    queryClient.invalidateQueries({ queryKey: ["finding-stats"] });
  };

  const hasAnyFindings = stats?.totalCount && stats.totalCount > 0;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Findings</h1>
          <p className="text-muted-foreground">
            Security, cost, and compliance issues detected in your infrastructure
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Stats toggle */}
          <Button
            variant={showStats ? "default" : "outline"}
            size="sm"
            onClick={() => setShowStats(!showStats)}
            className="hidden sm:flex"
          >
            <BarChart3 className="mr-2 h-4 w-4" />
            {showStats ? "Hide Stats" : "Show Stats"}
          </Button>

          {/* Refresh button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isFetching}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats cards */}
      {showStats && (
        <FindingStatsCards stats={stats} isLoading={statsLoading} />
      )}

      {/* Main content */}
      {hasAnyFindings || isLoading ? (
        <div className="space-y-4">
          {/* Filters */}
          <FindingFiltersAdvanced
            filters={filters}
            onFiltersChange={setFilters}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            totalCount={stats?.totalCount || 0}
            filteredCount={filteredFindings.length}
          />

          {/* Table */}
          <FindingsTableAdvanced
            findings={filteredFindings}
            onSelectFinding={handleSelectFinding}
            isLoading={isLoading}
          />
        </div>
      ) : (
        <EmptyState
          icon={AlertTriangle}
          title="No findings"
          description="Great! No issues found in your infrastructure. Run a scan to check for new findings."
        />
      )}

      {/* Finding detail modal */}
      <FindingDetailModal
        finding={selectedFinding}
        onClose={handleCloseModal}
        onUpdateStatus={handleUpdateStatus}
        isUpdating={updateStatus.isPending}
      />
    </div>
  );
}
