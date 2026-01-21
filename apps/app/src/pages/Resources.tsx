import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ResourceFiltersAdvanced } from "@/components/resources/ResourceFiltersAdvanced";
import { ResourcesTableAdvanced } from "@/components/resources/ResourcesTableAdvanced";
import { ResourceStatsCards } from "@/components/resources/ResourceStatsCards";
import { EmptyState } from "@/components/shared/EmptyState";
import { PaywallBlocker } from "@/components/shared/PaywallBlocker";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ServiceIcon, getServiceLabel } from "@/components/shared/ServiceIcon";
import {
  useResources,
  useResourceRegions,
  useResourceServices,
  useResourceStats,
} from "@/hooks/use-resources";
import { useAwsAccounts, useRecentScans, useTriggerScan, useScanCompletionRefresh } from "@/hooks/use-aws-accounts";
import { useAuthStore } from "@/stores/auth-store";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { toast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import type { ResourceFilters as Filters, ServiceType, Resource } from "@/types";
import { ACTIVE_SCAN_STATUSES, TIER_LIMITS } from "@/types";
import { Server, RefreshCw, LayoutGrid, List, Scan, Play, ArrowRight } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

type ViewMode = "table" | "grid";

type SortField = "name" | "service" | "region" | "state" | "cost" | "lastSeen";
type SortDirection = "asc" | "desc";

export default function Resources() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { org } = useAuthStore();
  const [filters, setFilters] = useLocalStorage<Filters>("resources:filters", {});
  const [searchQuery, setSearchQuery] = useLocalStorage<string>("resources:search", "");
  const [viewMode, setViewMode] = useLocalStorage<ViewMode>("resources:viewMode", "table");
  const [sortOverride, setSortOverride] = useState<{ field: SortField; direction: SortDirection } | null>(null);

  // Check tier-based access
  const tier = org?.tier || 'free';
  const canViewResourceList = TIER_LIMITS[tier].canViewResourceList;

  // Fetch all resources (we'll filter client-side for search)
  const { data: resourcesResponse, isLoading, isFetching } = useResources(filters, { enabled: canViewResourceList });
  const allResources = resourcesResponse?.data || [];
  const { data: regions = [] } = useResourceRegions();
  const { data: services = [] } = useResourceServices();
  const { data: stats, isLoading: statsLoading } = useResourceStats();

  // Fetch accounts and scans for empty state logic
  const { accounts, isLoading: accountsLoading } = useAwsAccounts();
  const { data: recentScans } = useRecentScans(10);
  const triggerScan = useTriggerScan();

  // Auto-refresh data when scans complete
  const { activeScans } = useScanCompletionRefresh();

  // Client-side search filter
  const filteredResources = useMemo(() => {
    if (!searchQuery.trim()) return allResources;

    const query = searchQuery.toLowerCase();
    return allResources.filter(
      (resource) =>
        resource.name?.toLowerCase().includes(query) ||
        resource.resourceId.toLowerCase().includes(query) ||
        resource.service.toLowerCase().includes(query)
    );
  }, [allResources, searchQuery]);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["resources"] });
    queryClient.invalidateQueries({ queryKey: ["resource-stats"] });
    queryClient.invalidateQueries({ queryKey: ["resource-regions"] });
    queryClient.invalidateQueries({ queryKey: ["resource-services"] });
  };

  const handleStatsFilterSelect = (filter: { service?: ServiceType; region?: string; sortBy?: string }) => {
    // Update filters - clear other filters and set the selected one
    setFilters({
      service: filter.service,
      region: filter.region,
    });

    // Update sort if sorting by cost
    if (filter.sortBy === "cost") {
      setSortOverride({ field: "cost", direction: "desc" });
    } else {
      setSortOverride(null);
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

  const hasAnyResources = stats?.totalCount && stats.totalCount > 0;
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
          <h1 className="text-2xl font-bold tracking-tight">Resources</h1>
          <p className="text-muted-foreground">
            Browse and manage your AWS infrastructure
          </p>
        </div>
        {hasCompletedScan && (
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex items-center rounded-lg border p-1">
              <Button
                variant={viewMode === "table" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-2"
                onClick={() => setViewMode("table")}
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-2"
                onClick={() => setViewMode("grid")}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </div>

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
        <ResourceStatsCards
          stats={stats}
          isLoading={statsLoading}
          onFilterSelect={handleStatsFilterSelect}
        />
      )}

      {/* Paywall for free tier */}
      {hasCompletedScan && !canViewResourceList && (
        <PaywallBlocker feature="resources" />
      )}

      {/* Invitation to start first scan */}
      {!accountsLoading && hasAccounts && !hasCompletedScan && !hasScanInProgress && (
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-primary/20 p-5">
              <Scan className="h-10 w-10 text-primary" />
            </div>
            <h3 className="mt-6 text-xl font-semibold">Discover your AWS resources</h3>
            <p className="mt-3 max-w-lg text-muted-foreground">
              Your AWS account is connected. Run your first scan to discover all your
              infrastructure resources including EC2 instances, S3 buckets, RDS databases,
              Lambda functions, and more.
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
            <h3 className="mt-6 text-xl font-semibold">Scanning your infrastructure...</h3>
            <p className="mt-3 max-w-lg text-muted-foreground">
              Your AWS account is being scanned. This may take a few minutes depending on
              the size of your infrastructure. Resources will appear here once the scan completes.
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
      {hasCompletedScan && canViewResourceList && (hasAnyResources || isLoading) && (
        <div className="space-y-4">
          {/* Filters */}
          <ResourceFiltersAdvanced
            filters={filters}
            onFiltersChange={setFilters}
            regions={regions}
            services={services as ServiceType[]}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            totalCount={stats?.totalCount || 0}
            filteredCount={filteredResources.length}
          />

          {/* Table or grid view */}
          {viewMode === "table" ? (
            <ResourcesTableAdvanced
              resources={filteredResources}
              isLoading={isLoading}
              initialSortField={sortOverride?.field}
              initialSortDirection={sortOverride?.direction}
            />
          ) : (
            <ResourcesGridView
              resources={filteredResources}
              isLoading={isLoading}
            />
          )}
        </div>
      )}

      {/* No accounts state */}
      {!accountsLoading && !hasAccounts && (
        <EmptyStateWithAction />
      )}
    </div>
  );
}

// Empty state with navigation action
function EmptyStateWithAction() {
  const navigate = useNavigate();
  return (
    <EmptyState
      icon={Server}
      title="No resources found"
      description="Connect an AWS account and run a scan to discover your infrastructure resources."
      actionLabel="Connect AWS Account"
      onAction={() => navigate("/accounts")}
    />
  );
}

// Grid view component
function ResourcesGridView({
  resources,
  isLoading,
}: {
  resources: Resource[];
  isLoading?: boolean;
}) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="animate-pulse rounded-lg border bg-card p-4 space-y-3"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded bg-muted" />
              <div className="space-y-1.5">
                <div className="h-4 w-24 rounded bg-muted" />
                <div className="h-3 w-16 rounded bg-muted" />
              </div>
            </div>
            <div className="h-3 w-full rounded bg-muted" />
            <div className="flex gap-2">
              <div className="h-5 w-16 rounded bg-muted" />
              <div className="h-5 w-20 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (resources.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-lg border bg-muted/30">
        <p className="text-muted-foreground">No resources match your filters</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {resources.map((resource) => (
        <Card
          key={resource.id}
          className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50"
          onClick={() => navigate(`/overview/resources/${resource.id}`)}
        >
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-muted p-2">
                <ServiceIcon
                  service={resource.service}
                  className="h-6 w-6"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">
                  {resource.name || resource.resourceId}
                </p>
                <p className="text-sm text-muted-foreground">
                  {getServiceLabel(resource.service)}
                </p>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground font-mono truncate">
              {resource.resourceId}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {resource.region && (
                <Badge variant="outline" className="text-xs">
                  {resource.region}
                </Badge>
              )}
              {resource.state && (
                <Badge
                  variant={
                    resource.state === "running" || resource.state === "active"
                      ? "success"
                      : "secondary"
                  }
                  className="text-xs capitalize"
                >
                  {resource.state}
                </Badge>
              )}
              {resource.costEstimateMonthly && (
                <Badge variant="outline" className="text-xs">
                  {formatCurrency(parseFloat(resource.costEstimateMonthly))}/mo
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
