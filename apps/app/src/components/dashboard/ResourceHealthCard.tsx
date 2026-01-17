import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Server, TrendingUp, TrendingDown, Minus, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import type { EnhancedDashboardSummary } from "@/types";

interface ResourceHealthCardProps {
  summary: EnhancedDashboardSummary | undefined;
  isLoading?: boolean;
  previousTotal?: number;
  accountId?: string;
}

export function ResourceHealthCard({ summary, isLoading, previousTotal, accountId }: ResourceHealthCardProps) {
  if (isLoading || !summary) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Resource Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-6 w-32 bg-muted rounded" />
            <div className="flex gap-2">
              <div className="h-8 w-20 bg-muted rounded" />
              <div className="h-8 w-20 bg-muted rounded" />
              <div className="h-8 w-20 bg-muted rounded" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { resourceHealth, totalResources } = summary;
  const baseResourcesUrl = accountId ? `/accounts/${accountId}/resources` : "/resources";

  // Calculate trend
  const trend = previousTotal !== undefined ? totalResources - previousTotal : undefined;

  // Calculate percentages for the donut-like display
  const healthyPercent = totalResources > 0 ? Math.round((resourceHealth.healthy / totalResources) * 100) : 100;
  const warningPercent = totalResources > 0 ? Math.round((resourceHealth.warning / totalResources) * 100) : 0;
  const criticalPercent = totalResources > 0 ? Math.round((resourceHealth.critical / totalResources) * 100) : 0;

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4" />
            Resource Health
          </div>
          <Link
            to={baseResourcesUrl}
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            View all
            <ExternalLink className="h-3 w-3" />
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Total resources with trend */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold">{totalResources}</span>
            <span className="text-sm text-muted-foreground">total resources</span>
            {trend !== undefined && trend !== 0 && (
              <span className={cn(
                "flex items-center text-xs",
                trend > 0 ? "text-green-500" : "text-red-500"
              )}>
                {trend > 0 ? <TrendingUp className="h-3 w-3 mr-0.5" /> : <TrendingDown className="h-3 w-3 mr-0.5" />}
                {trend > 0 ? "+" : ""}{trend}
              </span>
            )}
            {trend === 0 && previousTotal !== undefined && (
              <span className="flex items-center text-xs text-muted-foreground">
                <Minus className="h-3 w-3 mr-0.5" />
              </span>
            )}
          </div>
        </div>

        {/* Health breakdown */}
        {totalResources > 0 ? (
          <div className="grid grid-cols-3 gap-2">
            {/* Healthy */}
            <div className="text-center p-2 rounded-lg bg-green-500/10 border border-green-500/20">
              <div className="text-lg font-semibold text-green-500">
                {resourceHealth.healthy}
              </div>
              <div className="text-xs text-muted-foreground">
                Healthy
              </div>
              <div className="text-xs text-green-500/70 mt-0.5">
                {healthyPercent}%
              </div>
            </div>

            {/* Warning */}
            <div className="text-center p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <div className="text-lg font-semibold text-yellow-500">
                {resourceHealth.warning}
              </div>
              <div className="text-xs text-muted-foreground">
                Warning
              </div>
              <div className="text-xs text-yellow-500/70 mt-0.5">
                {warningPercent}%
              </div>
            </div>

            {/* Critical */}
            <div className="text-center p-2 rounded-lg bg-red-500/10 border border-red-500/20">
              <div className="text-lg font-semibold text-red-500">
                {resourceHealth.critical}
              </div>
              <div className="text-xs text-muted-foreground">
                Critical
              </div>
              <div className="text-xs text-red-500/70 mt-0.5">
                {criticalPercent}%
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-4 text-sm text-muted-foreground">
            No resources discovered yet. Run a scan to get started.
          </div>
        )}

        {/* Health bar visualization */}
        {totalResources > 0 && (
          <div className="h-2 w-full bg-muted rounded-full overflow-hidden flex">
            <div
              className="h-full bg-green-500 transition-all"
              style={{ width: `${healthyPercent}%` }}
            />
            <div
              className="h-full bg-yellow-500 transition-all"
              style={{ width: `${warningPercent}%` }}
            />
            <div
              className="h-full bg-red-500 transition-all"
              style={{ width: `${criticalPercent}%` }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
