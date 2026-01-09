import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { ServiceIcon, getServiceLabel } from "@/components/shared/ServiceIcon";
import type { ResourceStats, ServiceType } from "@/types";
import {
  Server,
  Globe,
  Activity,
  TrendingUp,
} from "lucide-react";

interface ResourceStatsCardsProps {
  stats: ResourceStats | undefined;
  isLoading?: boolean;
}

export function ResourceStatsCards({ stats, isLoading }: ResourceStatsCardsProps) {
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

  // Get top services by count (with null check)
  const topServices = stats.byService
    ? Object.entries(stats.byService)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
    : [];

  // Get top regions by count (with null check)
  const topRegions = stats.byRegion
    ? Object.entries(stats.byRegion)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
    : [];

  // Calculate active vs inactive (with null checks)
  const byState = stats.byState || {};
  const activeCount = (byState["running"] || 0) +
                      (byState["active"] || 0) +
                      (byState["in-use"] || 0) +
                      (byState["available"] || 0);
  const inactiveCount = (byState["stopped"] || 0) +
                        (byState["inactive"] || 0);

  const serviceCount = stats.byService ? Object.keys(stats.byService).length : 0;
  const regionCount = stats.byRegion ? Object.keys(stats.byRegion).length : 0;

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

        {/* Services */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  AWS Services
                </p>
                <p className="mt-1 text-3xl font-bold">{serviceCount}</p>
              </div>
              <div className="rounded-full bg-blue-500/10 p-3">
                <TrendingUp className="h-6 w-6 text-blue-500" />
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
              <div className="rounded-full bg-green-500/10 p-3">
                <Globe className="h-6 w-6 text-green-500" />
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
                  Active / Inactive
                </p>
                <p className="mt-1 text-3xl font-bold">
                  <span className="text-green-600">{activeCount}</span>
                  <span className="mx-1 text-muted-foreground">/</span>
                  <span className="text-muted-foreground">{inactiveCount}</span>
                </p>
              </div>
              <div className="rounded-full bg-orange-500/10 p-3">
                <Activity className="h-6 w-6 text-orange-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Service breakdown */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top Services */}
        <Card>
          <CardContent className="p-6">
            <h3 className="mb-4 text-sm font-medium text-muted-foreground">
              Resources by Service
            </h3>
            <div className="space-y-3">
              {topServices.map(([service, count]) => {
                const percentage = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;
                return (
                  <div key={service} className="flex items-center gap-3">
                    <ServiceIcon service={service as ServiceType} className="h-5 w-5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium truncate">
                          {getServiceLabel(service as ServiceType)}
                        </span>
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
              {topServices.length === 0 && (
                <p className="text-sm text-muted-foreground">No resources discovered</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top Regions */}
        <Card>
          <CardContent className="p-6">
            <h3 className="mb-4 text-sm font-medium text-muted-foreground">
              Resources by Region
            </h3>
            <div className="space-y-3">
              {topRegions.map(([region, count]) => {
                const percentage = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;
                return (
                  <div key={region} className="flex items-center gap-3">
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
                          className="h-full rounded-full bg-green-500 transition-all duration-300"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
              {topRegions.length === 0 && (
                <p className="text-sm text-muted-foreground">No regions found</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
