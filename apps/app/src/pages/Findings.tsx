import { useState, useEffect, useMemo } from "react";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useSearchParams, useNavigate } from "react-router-dom";
import { FindingFiltersAdvanced } from "@/components/findings/FindingFiltersAdvanced";
import { FindingsTableAdvanced } from "@/components/findings/FindingsTableAdvanced";
import { FindingStatsCards } from "@/components/findings/FindingStatsCards";
import { FindingDetailModal } from "@/components/findings/FindingDetailModal";
import { EmptyState } from "@/components/shared/EmptyState";
import { PaywallBlocker } from "@/components/shared/PaywallBlocker";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  useFilteredFindings,
  useUpdateFindingStatus,
  useFilteredFindingStats,
} from "@/hooks/use-findings";
import { useAwsAccounts, useRecentScans, useTriggerScan, useScanCompletionRefresh } from "@/hooks/use-aws-accounts";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "@/hooks/use-toast";
import type { FindingFilters as Filters, Finding, FindingStatus } from "@/types";
import { ACTIVE_SCAN_STATUSES, ORPHANED_FINDING_TYPES, TIER_LIMITS } from "@/types";
import { AlertTriangle, RefreshCw, Scan, Play, ArrowRight, Server } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function Findings() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { org } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useLocalStorage<Filters>("findings:filters", {});
  const [searchQuery, setSearchQuery] = useLocalStorage<string>("findings:search", "");
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);

  // Check tier-based access
  const tier = org?.tier || 'free';
  const canViewFindingList = TIER_LIMITS[tier].canViewFindingList;

  const { data: findingsResponse, isLoading, isFetching } = useFilteredFindings(filters, { enabled: canViewFindingList });
  const allFindings = findingsResponse?.data || [];
  const { data: stats, isLoading: statsLoading, unfilteredData: unfilteredStats } = useFilteredFindingStats();
  const updateStatus = useUpdateFindingStatus();

  // Fetch accounts and scans for empty state logic
  const { accounts, isLoading: accountsLoading } = useAwsAccounts();
  const { data: recentScans } = useRecentScans(10);
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
      // Set multi-type filter for orphaned resources
      newFilters.types = ORPHANED_FINDING_TYPES;
      newFilters.type = undefined;
    }

    // Handle single type filter (e.g., ?type=orphaned_volume)
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
    setFilters(newFilters);
    setSearchParams({}, { replace: true });
  }, [searchParams, setFilters, setSearchParams]);

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
      setFilters(prev => ({ ...prev, type: filter.type }));
    }
  };

  const handleScanAll = async () => {
    if (!accounts || accounts.length === 0) return;

    const results = await Promise.allSettled(
      accounts.map(account => triggerScan.mutateAsync(account.id))
    );

    const succeeded = results.filter(r => r.status === "fulfilled").length;
    const failed = results.filter(r => r.status === "rejected").length;

    if (failed === 0) {
      toast({
        title: "Scans started",
        description: `Started scanning ${succeeded} AWS account(s).`,
        type: "success",
      });
    } else if (succeeded === 0) {
      toast({
        title: "Scans failed",
        description: `Failed to start scans for all ${failed} account(s). Please try again.`,
        type: "error",
      });
    } else {
      toast({
        title: "Scans partially started",
        description: `Started ${succeeded} scan(s), ${failed} failed to start.`,
        type: "warning",
      });
    }
  };

  // Use unfiltered stats to determine if there are any findings at all
  // This way the UI still shows when all findings are hidden by viewing settings
  const hasAnyFindings = useMemo(() => {
    const checkStats = unfilteredStats;
    if (!checkStats) return false;
    if (checkStats.totalCount && checkStats.totalCount > 0) return true;

    // Fallback: check byStatus
    const byStatus = checkStats.byStatus || {};
    const statusTotal = Object.values(byStatus).reduce((sum, count) => sum + count, 0);
    if (statusTotal > 0) return true;

    // Fallback: check byType
    const byType = checkStats.byType || {};
    return Object.values(byType).reduce((sum, count) => sum + count, 0) > 0;
  }, [unfilteredStats]);
  const hasAccounts = accounts && accounts.length > 0;
  const hasCompletedScan = recentScans?.some(scan =>
    scan.status === "complete" || scan.status === "partial"
  );
  const hasScanInProgress = (activeScans && activeScans.length > 0) ||
    recentScans?.some(scan => ACTIVE_SCAN_STATUSES.includes(scan.status));

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
        {hasCompletedScan && (
          <div className="flex items-center gap-2">
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

      {/* Paywall for free tier */}
      {hasCompletedScan && !canViewFindingList && (
        <PaywallBlocker feature="findings" />
      )}

      {/* No accounts state */}
      {!accountsLoading && !hasAccounts && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-primary/10 p-4">
              <Server className="h-8 w-8 text-primary" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">No AWS accounts connected</h3>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Connect your AWS accounts and run a scan to discover security,
              cost, and compliance findings.
            </p>
            <Button className="mt-6" onClick={() => navigate("/accounts")}>
              Connect AWS Account
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Invitation to start first scan */}
      {!accountsLoading && hasAccounts && !hasCompletedScan && !hasScanInProgress && (
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-primary/20 p-5">
              <Scan className="h-10 w-10 text-primary" />
            </div>
            <h3 className="mt-6 text-xl font-semibold">Discover security and cost issues</h3>
            <p className="mt-3 max-w-lg text-muted-foreground">
              Your AWS account is connected. Run your first scan to identify
              security vulnerabilities, cost optimization opportunities,
              and compliance issues in your infrastructure.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button
                size="lg"
                onClick={handleScanAll}
                disabled={triggerScan.isPending || hasScanInProgress}
              >
                <Play className="mr-2 h-5 w-5" />
                Start First Scan
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => navigate("/accounts")}
              >
                Manage Accounts
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scan in progress state */}
      {!accountsLoading && hasAccounts && !hasCompletedScan && hasScanInProgress && (
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-primary/20 p-5">
              <RefreshCw className="h-10 w-10 text-primary animate-spin" />
            </div>
            <h3 className="mt-6 text-xl font-semibold">Analyzing your infrastructure...</h3>
            <p className="mt-3 max-w-lg text-muted-foreground">
              Your AWS account is being scanned. This may take a few minutes depending on
              the size of your infrastructure. Findings will appear here once the scan completes.
            </p>
            <Button
              variant="outline"
              size="lg"
              className="mt-8"
              onClick={() => navigate("/scans")}
            >
              View Scan Progress
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Main content - only show after first scan and with permission */}
      {hasCompletedScan && canViewFindingList && (hasAnyFindings || isLoading) && (
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
      )}

      {/* No findings after scan completed */}
      {hasCompletedScan && canViewFindingList && !hasAnyFindings && !isLoading && (
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
