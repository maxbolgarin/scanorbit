import { useState } from "react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ServiceIcon, getServiceLabel } from "@/components/shared/ServiceIcon";
import type { ResourceStats, ServiceType } from "@/types";
import { formatCurrency } from "@/lib/utils";
import {
  Server,
  Globe,
  Activity,
  DollarSign,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const ITEMS_PER_PAGE = 5;

interface ResourceStatsCardsProps {
  stats: ResourceStats | undefined;
  isLoading?: boolean;
  onFilterSelect?: (filter: { service?: ServiceType; region?: string; sortBy?: string; state?: string }) => void;
}

export function ResourceStatsCards({ stats, isLoading, onFilterSelect }: ResourceStatsCardsProps) {
  const [servicePage, setServicePage] = useState(0);
  const [regionPage, setRegionPage] = useState(0);

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-4 w-20 rounded bg-muted" />
              <div className="mt-2 h-8 w-16 rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  // Safely get total count
  const totalCount = stats.totalCount ?? 0;

  // Get ALL paid services sorted by cost (descending)
  const allPaidServiceStats = stats.costByService
    ? Object.entries(stats.costByService)
        .sort(([, a], [, b]) => b.totalCost - a.totalCost)
    : [];

  // Calculate total estimated monthly cost
  const totalEstimatedCost = allPaidServiceStats.reduce(
    (sum, [, data]) => sum + data.totalCost,
    0
  );

  // Get ALL regions by count (with null check)
  const allRegions = stats.byRegion
    ? Object.entries(stats.byRegion)
        .sort(([, a], [, b]) => b - a)
    : [];

  // Pagination for services
  const serviceTotalPages = Math.ceil(allPaidServiceStats.length / ITEMS_PER_PAGE);
  const paginatedServices = allPaidServiceStats.slice(
    servicePage * ITEMS_PER_PAGE,
    (servicePage + 1) * ITEMS_PER_PAGE
  );

  // Pagination for regions
  const regionTotalPages = Math.ceil(allRegions.length / ITEMS_PER_PAGE);
  const paginatedRegions = allRegions.slice(
    regionPage * ITEMS_PER_PAGE,
    (regionPage + 1) * ITEMS_PER_PAGE
  );

  // Calculate active vs inactive (with null checks)
  const byState = stats.byState || {};
  const activeCount = (byState["running"] || 0) +
                      (byState["active"] || 0) +
                      (byState["in-use"] || 0) +
                      (byState["available"] || 0);
  const inactiveCount = (byState["stopped"] || 0) +
                        (byState["inactive"] || 0);

  const regionCount = stats.byRegion ? Object.keys(stats.byRegion).length : 0;

  const handleServiceClick = (service: string) => {
    onFilterSelect?.({ service: service as ServiceType, sortBy: "cost" });
  };

  const handleRegionClick = (region: string) => {
    onFilterSelect?.({ region });
  };

  const handleStateClick = (state: string) => {
    onFilterSelect?.({ state });
  };

  return (
    <div className="space-y-4">
      {/* Main stats row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Resources */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Total Resources
                </p>
                <p className="mt-1 text-3xl font-bold">{totalCount.toLocaleString()}</p>
              </div>
              <div className="rounded-full bg-primary/10 p-3">
                <Server className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Estimated Monthly Cost */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Est. Monthly Cost
                </p>
                <p className="mt-1 text-3xl font-bold">
                  {formatCurrency(totalEstimatedCost)}
                </p>
              </div>
              <div className="rounded-full bg-muted p-3">
                <DollarSign className="h-6 w-6 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Regions */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Regions
                </p>
                <p className="mt-1 text-3xl font-bold">{regionCount}</p>
              </div>
              <div className="rounded-full bg-muted p-3">
                <Globe className="h-6 w-6 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Active Resources */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Running / Stopped
                </p>
                <p className="mt-1 text-3xl font-bold">
                  <span
                    className="text-status-success cursor-pointer hover:underline"
                    onClick={() => handleStateClick("running")}
                    title="Click to filter running resources"
                  >
                    {activeCount}
                  </span>
                  <span className="mx-1 text-muted-foreground">/</span>
                  <span
                    className="text-muted-foreground cursor-pointer hover:underline"
                    onClick={() => handleStateClick("stopped")}
                    title="Click to filter stopped resources"
                  >
                    {inactiveCount}
                  </span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  EC2, Lambda, EBS, EIP
                </p>
              </div>
              <div className="rounded-full bg-muted p-3">
                <Activity className="h-6 w-6 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Service breakdown */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Cost by Service (Paid Only) */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-muted-foreground">
                Cost by Service (Paid Only)
              </h3>
              {serviceTotalPages > 1 && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setServicePage(p => Math.max(0, p - 1))}
                    disabled={servicePage === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground px-1">
                    {servicePage + 1}/{serviceTotalPages}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setServicePage(p => Math.min(serviceTotalPages - 1, p + 1))}
                    disabled={servicePage === serviceTotalPages - 1}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
            <div className="space-y-3">
              {paginatedServices.map(([service, data]) => {
                // Calculate percentage with minimum 2% if there's any cost
                const rawPercentage = totalEstimatedCost > 0
                  ? (data.totalCost / totalEstimatedCost) * 100
                  : 0;
                const costPercentage = data.count > 0 ? Math.max(2, Math.round(rawPercentage)) : 0;
                return (
                  <div
                    key={service}
                    className="flex items-center gap-3 p-2 -mx-2 rounded-md cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleServiceClick(service)}
                  >
                    <ServiceIcon service={service as ServiceType} className="h-5 w-5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium truncate">
                          {getServiceLabel(service as ServiceType)}
                        </span>
                        <div className="flex items-center gap-2 ml-2">
                          <span className="text-sm text-muted-foreground">
                            {data.count}
                          </span>
                          <span className="text-sm font-medium text-muted-foreground">
                            {formatCurrency(data.totalCost)}
                          </span>
                        </div>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-status-warning transition-all duration-300"
                          style={{ width: `${costPercentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
              {allPaidServiceStats.length === 0 && (
                <p className="text-sm text-muted-foreground">No paid resources discovered</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Resources by Region */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-muted-foreground">
                Resources by Region
              </h3>
              {regionTotalPages > 1 && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setRegionPage(p => Math.max(0, p - 1))}
                    disabled={regionPage === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground px-1">
                    {regionPage + 1}/{regionTotalPages}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setRegionPage(p => Math.min(regionTotalPages - 1, p + 1))}
                    disabled={regionPage === regionTotalPages - 1}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
            <div className="space-y-3">
              {paginatedRegions.map(([region, count]) => {
                const percentage = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;
                return (
                  <div
                    key={region}
                    className="flex items-center gap-3 p-2 -mx-2 rounded-md cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleRegionClick(region)}
                  >
                    <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded bg-muted text-xs font-medium">
                      {region.split("-")[0]?.toUpperCase().slice(0, 2) || "??"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium truncate">{region}</span>
                        <span className="text-sm text-muted-foreground ml-2">
                          {count}
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all duration-300"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
              {allRegions.length === 0 && (
                <p className="text-sm text-muted-foreground">No regions found</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
