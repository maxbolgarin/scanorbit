import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Server, ExternalLink, AlertCircle, CheckCircle2, AlertTriangle, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import type { EnhancedDashboardSummary } from "@/types";

interface ResourceHealthCardProps {
  summary: EnhancedDashboardSummary | undefined;
  isLoading?: boolean;
  accountId?: string;
}

function formatSavings(amount: number): string {
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(1)}k`;
  }
  return `$${amount.toFixed(0)}`;
}

export function ResourceHealthCard({ summary, isLoading, accountId }: ResourceHealthCardProps) {
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
            <div className="flex items-center justify-between">
              <div className="h-6 w-32 bg-muted rounded" />
              <div className="h-4 w-20 bg-muted rounded" />
            </div>
            <div className="h-2.5 w-full bg-muted rounded" />
            <div className="grid grid-cols-3 gap-2">
              <div className="h-16 bg-muted rounded" />
              <div className="h-16 bg-muted rounded" />
              <div className="h-16 bg-muted rounded" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { totalResources, resourceHealth, costInsights } = summary;
  const baseFindingsUrl = accountId ? `/accounts/${accountId}/findings` : "/overview/findings";
  const baseResourcesUrl = accountId ? `/accounts/${accountId}/resources` : "/overview/resources";

  // Calculate percentages
  const healthyPercent = totalResources > 0 ? (resourceHealth.healthy / totalResources) * 100 : 100;
  const warningPercent = totalResources > 0 ? (resourceHealth.warning / totalResources) * 100 : 0;
  const criticalPercent = totalResources > 0 ? (resourceHealth.critical / totalResources) * 100 : 0;

  // Get top issues for the list (if any)
  const topIssues = [...costInsights.byCategory]
    .filter(item => item.count > 0)
    .sort((a, b) => b.savings - a.savings)
    .slice(0, 3);

  const resourcesWithIssues = resourceHealth.warning + resourceHealth.critical;

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
      <CardContent className="space-y-3">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div>
            <span className="text-2xl font-bold">{totalResources}</span>
            <span className="text-sm text-muted-foreground ml-2">total resources</span>
          </div>
          {resourcesWithIssues > 0 && (
            <span className="text-sm text-orange-500 flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              {resourcesWithIssues} with issues
            </span>
          )}
        </div>

        {totalResources > 0 ? (
          <>
            {/* Health distribution bar */}
            <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden flex">
              {healthyPercent > 0 && (
                <div
                  className="h-full bg-green-500 transition-all"
                  style={{ width: `${healthyPercent}%` }}
                  title={`${resourceHealth.healthy} Healthy`}
                />
              )}
              {warningPercent > 0 && (
                <div
                  className="h-full bg-yellow-500 transition-all"
                  style={{ width: `${warningPercent}%` }}
                  title={`${resourceHealth.warning} Warning`}
                />
              )}
              {criticalPercent > 0 && (
                <div
                  className="h-full bg-red-500 transition-all"
                  style={{ width: `${criticalPercent}%` }}
                  title={`${resourceHealth.critical} Critical`}
                />
              )}
            </div>

            {/* Health breakdown grid */}
            <div className="grid grid-cols-3 gap-2">
              <div className={cn(
                "text-center p-2 rounded-lg border",
                resourceHealth.healthy > 0
                  ? "bg-green-500/10 border-green-500/20"
                  : "bg-muted/50 border-border"
              )}>
                <div className="flex items-center justify-center gap-1 mb-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                </div>
                <div className={cn(
                  "text-lg font-semibold",
                  resourceHealth.healthy > 0 ? "text-green-500" : "text-muted-foreground"
                )}>
                  {resourceHealth.healthy}
                </div>
                <div className="text-xs text-muted-foreground">Healthy</div>
              </div>

              <div className={cn(
                "text-center p-2 rounded-lg border",
                resourceHealth.warning > 0
                  ? "bg-yellow-500/10 border-yellow-500/20"
                  : "bg-muted/50 border-border"
              )}>
                <div className="flex items-center justify-center gap-1 mb-1">
                  <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />
                </div>
                <div className={cn(
                  "text-lg font-semibold",
                  resourceHealth.warning > 0 ? "text-yellow-500" : "text-muted-foreground"
                )}>
                  {resourceHealth.warning}
                </div>
                <div className="text-xs text-muted-foreground">Warning</div>
              </div>

              <div className={cn(
                "text-center p-2 rounded-lg border",
                resourceHealth.critical > 0
                  ? "bg-red-500/10 border-red-500/20"
                  : "bg-muted/50 border-border"
              )}>
                <div className="flex items-center justify-center gap-1 mb-1">
                  <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                </div>
                <div className={cn(
                  "text-lg font-semibold",
                  resourceHealth.critical > 0 ? "text-red-500" : "text-muted-foreground"
                )}>
                  {resourceHealth.critical}
                </div>
                <div className="text-xs text-muted-foreground">Critical</div>
              </div>
            </div>

            {/* Top issues list (if any with cost savings) */}
            {topIssues.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-border">
                {topIssues.map((issue) => (
                  <Link
                    key={issue.type}
                    to={`${baseFindingsUrl}?type=${issue.type}&status=open`}
                    className="flex items-center justify-between py-1 text-xs hover:underline group"
                  >
                    <span className="text-muted-foreground group-hover:text-foreground">
                      {issue.count} {issue.label}
                    </span>
                    <span className="text-orange-500 flex items-center gap-0.5">
                      {issue.savings > 0 ? (
                        <>
                          <DollarSign className="h-3 w-3" />
                          {formatSavings(issue.savings)}/mo
                        </>
                      ) : (
                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                      )}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-6 text-sm text-muted-foreground">
            No resources discovered yet. Run a scan to get started.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
