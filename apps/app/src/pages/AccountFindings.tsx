import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { FindingFiltersAdvanced } from "@/components/findings/FindingFiltersAdvanced";
import { FindingsTableAdvanced } from "@/components/findings/FindingsTableAdvanced";
import { FindingStatsCards } from "@/components/findings/FindingStatsCards";
import { FindingDetailModal } from "@/components/findings/FindingDetailModal";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  useFilteredFindings,
  useUpdateFindingStatus,
  useFilteredFindingStats,
} from "@/hooks/use-findings";
import { useAwsAccount, useScanHistory, useTriggerScan, useScanCompletionRefresh } from "@/hooks/use-aws-accounts";
import { toast } from "@/hooks/use-toast";
import type { FindingFilters as Filters, Finding, FindingStatus } from "@/types";
import { ACTIVE_SCAN_STATUSES, ORPHANED_FINDING_TYPES } from "@/types";
import { AlertTriangle, RefreshCw, Scan, Play, ArrowRight, Cloud } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function AccountFindings() {
  const { accountId } = useParams<{ accountId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // Combine account filter with other filters
  const [baseFilters, setBaseFilters] = useLocalStorage<Filters>(`findings:filters:${accountId}`, {});
  const filters = useMemo(() => ({ ...baseFilters, awsAccountId: accountId }), [baseFilters, accountId]);

  const [searchQuery, setSearchQuery] = useLocalStorage<string>(`findings:search:${accountId}`, "");
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);

  // Fetch account-specific data
  const { data: account, isLoading: accountLoading } = useAwsAccount(accountId!);
  const { data: findingsResponse, isLoading, isFetching } = useFilteredFindings(filters);
  const allFindings = findingsResponse?.data || [];
  const { data: stats, isLoading: statsLoading, unfilteredData: unfilteredStats } = useFilteredFindingStats({ awsAccountId: accountId });
  const updateStatus = useUpdateFindingStatus();

  // Fetch scan data for empty state logic
  const { data: scanHistory } = useScanHistory(accountId!);
  const triggerScan = useTriggerScan();

  // Auto-refresh data when scans complete
  const { activeScans } = useScanCompletionRefresh();

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

  // Handle URL parameters for filters (e.g., from dashboard click-through)
  useEffect(() => {
    const category = searchParams.get("category");
    const severityParam = searchParams.get("severity");
    const statusParam = searchParams.get("status");
    const type = searchParams.get("type");
    const types = searchParams.get("types");

    // Skip if no filter params in URL
    if (!category && !severityParam && !statusParam && !type && !types) {
      return;
    }

    const newFilters: Partial<Filters> = {};

    if (category === "orphaned") {
      newFilters.types = ORPHANED_FINDING_TYPES;
      newFilters.type = undefined;
    }

    // Handle single type filter (e.g., ?type=unused_security_group)
    if (type) {
      newFilters.type = type as Filters["type"];
      newFilters.types = undefined;
    }

    // Handle multiple types filter (e.g., ?types=orphaned_volume,orphaned_eip)
    if (types) {
      const typeArray = types.split(",").filter(Boolean);
      if (typeArray.length > 0) {
        newFilters.types = typeArray as Filters["types"];
        newFilters.type = undefined;
      }
    }

    if (severityParam && ["critical", "high", "medium", "low", "trivial"].includes(severityParam)) {
      newFilters.severity = severityParam as Filters["severity"];
    }

    if (statusParam && ["open", "resolved", "snoozed", "ignored"].includes(statusParam)) {
      newFilters.status = statusParam as Filters["status"];
    }

    // Apply filters and clear URL params
    setBaseFilters(newFilters);
    setSearchParams({}, { replace: true });
  }, [searchParams, setBaseFilters, setSearchParams]);

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

  const handleStatsFilterSelect = (filter: { type?: Filters["type"] }) => {
    if (filter.type) {
      setBaseFilters(prev => ({ ...prev, type: filter.type }));
    }
  };

  const handleScan = async () => {
    if (!accountId) return;

    try {
      await triggerScan.mutateAsync(accountId);
      toast({
        title: "Scan started",
        description: "Your AWS account is being scanned.",
        type: "success",
      });
    } catch {
      toast({
        title: "Scan failed",
        description: "Failed to start scan. Please try again.",
        type: "error",
      });
    }
  };

  // Use unfiltered stats to determine if there are any findings at all
  const hasAnyFindings = useMemo(() => {
    const checkStats = unfilteredStats;
    if (!checkStats) return false;
    if (checkStats.totalCount && checkStats.totalCount > 0) return true;

    const byStatus = checkStats.byStatus || {};
    const statusTotal = Object.values(byStatus).reduce((sum, count) => sum + count, 0);
    if (statusTotal > 0) return true;

    const byType = checkStats.byType || {};
    return Object.values(byType).reduce((sum, count) => sum + count, 0) > 0;
  }, [unfilteredStats]);

  const hasCompletedScan = scanHistory?.some(scan =>
    scan.status === "complete" || scan.status === "partial"
  );
  const hasScanInProgress = activeScans?.some(scan => scan.awsAccountId === accountId) ||
    scanHistory?.some(scan => ACTIVE_SCAN_STATUSES.includes(scan.status));

  const baseUrl = `/accounts/${accountId}`;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <Cloud className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Findings</h1>
            <p className="text-muted-foreground">
              {account?.name || "Loading..."} &bull; {account?.awsAccountId}
            </p>
          </div>
        </div>
        {hasCompletedScan && (
          <div className="flex items-center gap-2">
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
        )}
      </div>

      {/* Stats cards - only show after first scan */}
      {hasCompletedScan && (
        <FindingStatsCards
          stats={stats}
          isLoading={statsLoading}
          onFilterSelect={handleStatsFilterSelect}
        />
      )}

      {/* Invitation to start first scan */}
      {!accountLoading && account?.status === "ok" && !hasCompletedScan && !hasScanInProgress && (
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-primary/20 p-5">
              <Scan className="h-10 w-10 text-primary" />
            </div>
            <h3 className="mt-6 text-xl font-semibold">Discover security and cost issues</h3>
            <p className="mt-3 max-w-lg text-muted-foreground">
              Run a scan to identify security vulnerabilities, cost optimization opportunities,
              and compliance issues in this account.
            </p>
            <Button
              size="lg"
              className="mt-8"
              onClick={handleScan}
              disabled={triggerScan.isPending || hasScanInProgress}
            >
              <Play className="mr-2 h-5 w-5" />
              Start Scan
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Scan in progress state */}
      {!accountLoading && account?.status === "ok" && !hasCompletedScan && hasScanInProgress && (
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-primary/20 p-5">
              <RefreshCw className="h-10 w-10 text-primary animate-spin" />
            </div>
            <h3 className="mt-6 text-xl font-semibold">Analyzing your infrastructure...</h3>
            <p className="mt-3 max-w-lg text-muted-foreground">
              This account is being scanned. Findings will appear here once the scan completes.
            </p>
            <Button
              variant="outline"
              size="lg"
              className="mt-8"
              onClick={() => navigate(`${baseUrl}/scans`)}
            >
              View Scan Progress
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Main content - only show after first scan */}
      {hasCompletedScan && (hasAnyFindings || isLoading) && (
        <div className="space-y-4">
          {/* Filters */}
          <FindingFiltersAdvanced
            filters={baseFilters}
            onFiltersChange={setBaseFilters}
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
      )}

      {/* No findings after scan completed */}
      {hasCompletedScan && !hasAnyFindings && !isLoading && (
        <EmptyState
          icon={AlertTriangle}
          title="No findings"
          description="Great! No issues found in this account."
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
