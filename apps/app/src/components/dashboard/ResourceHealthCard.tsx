import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Server, ExternalLink, AlertCircle, CheckCircle2, AlertTriangle, Unplug } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import type { EnhancedDashboardSummary } from "@/types";

interface ResourceHealthCardProps {
  summary: EnhancedDashboardSummary | undefined;
  isLoading?: boolean;
  accountId?: string;
}

export function ResourceHealthCard({ summary, isLoading, accountId }: ResourceHealthCardProps) {
  if (isLoading || !summary) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-foreground">
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
            <div className="grid grid-cols-4 gap-2">
              <div className="h-16 bg-muted rounded" />
              <div className="h-16 bg-muted rounded" />
              <div className="h-16 bg-muted rounded" />
              <div className="h-16 bg-muted rounded" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { totalResources, resourceHealth } = summary;
  const baseResourcesUrl = accountId ? `/accounts/${accountId}/resources` : "/overview/resources";

  // Calculate percentages
  const healthyPercent = totalResources > 0 ? (resourceHealth.healthy / totalResources) * 100 : 100;
  const warningPercent = totalResources > 0 ? (resourceHealth.warning / totalResources) * 100 : 0;
  const criticalPercent = totalResources > 0 ? (resourceHealth.critical / totalResources) * 100 : 0;
  const orphanedPercent = totalResources > 0 ? ((resourceHealth.orphaned ?? 0) / totalResources) * 100 : 0;

  const resourcesWithIssues = resourceHealth.warning + resourceHealth.critical;

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-foreground flex items-center justify-between">
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
            <span className="text-sm text-status-high flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              {resourcesWithIssues} with issues
            </span>
          )}
        </div>

        {totalResources > 0 ? (
          <>
            {/* Health distribution bar */}
            {(() => {
              const segments = [
                { key: "healthy", percent: healthyPercent, color: "bg-status-success", label: `${resourceHealth.healthy} Healthy` },
                { key: "warning", percent: warningPercent, color: "bg-status-warning", label: `${resourceHealth.warning} Warning` },
                { key: "critical", percent: criticalPercent, color: "bg-status-critical", label: `${resourceHealth.critical} Critical` },
                { key: "orphaned", percent: orphanedPercent, color: "bg-status-trivial", label: `${resourceHealth.orphaned ?? 0} Orphaned` },
              ].filter(s => s.percent > 0);

              return (
                <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden flex">
                  {segments.map((seg, i) => (
                    <div
                      key={seg.key}
                      className={cn(
                        "h-full transition-all",
                        seg.color,
                        i === 0 && "rounded-l-full",
                        i === segments.length - 1 && "rounded-r-full",
                      )}
                      style={{ width: `${seg.percent}%` }}
                      title={seg.label}
                    />
                  ))}
                </div>
              );
            })()}

            {/* Health breakdown grid */}
            <div className="grid grid-cols-4 gap-2">
              <Link
                to={`${baseResourcesUrl}?health=healthy`}
                className={cn(
                  "text-center p-2 rounded-lg border transition-colors hover:bg-muted/50 active:scale-95",
                  resourceHealth.healthy > 0
                    ? "bg-status-success/15 border-status-success/30"
                    : "bg-muted/50 border-border"
                )}
              >
                <div className="flex items-center justify-center gap-1 mb-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-status-success" />
                </div>
                <div className={cn(
                  "text-lg font-semibold",
                  resourceHealth.healthy > 0 ? "text-status-success" : "text-muted-foreground"
                )}>
                  {resourceHealth.healthy}
                </div>
                <div className="text-xs text-muted-foreground">Healthy</div>
              </Link>

              <Link
                to={`${baseResourcesUrl}?health=warning`}
                className={cn(
                  "text-center p-2 rounded-lg border transition-colors hover:bg-muted/50 active:scale-95",
                  resourceHealth.warning > 0
                    ? "bg-status-warning/15 border-status-warning/30"
                    : "bg-muted/50 border-border"
                )}
              >
                <div className="flex items-center justify-center gap-1 mb-1">
                  <AlertTriangle className="h-3.5 w-3.5 text-status-warning" />
                </div>
                <div className={cn(
                  "text-lg font-semibold",
                  resourceHealth.warning > 0 ? "text-status-warning" : "text-muted-foreground"
                )}>
                  {resourceHealth.warning}
                </div>
                <div className="text-xs text-muted-foreground">Warning</div>
              </Link>

              <Link
                to={`${baseResourcesUrl}?health=critical`}
                className={cn(
                  "text-center p-2 rounded-lg border transition-colors hover:bg-muted/50 active:scale-95",
                  resourceHealth.critical > 0
                    ? "bg-status-critical/15 border-status-critical/30"
                    : "bg-muted/50 border-border"
                )}
              >
                <div className="flex items-center justify-center gap-1 mb-1">
                  <AlertCircle className="h-3.5 w-3.5 text-status-critical" />
                </div>
                <div className={cn(
                  "text-lg font-semibold",
                  resourceHealth.critical > 0 ? "text-status-critical" : "text-muted-foreground"
                )}>
                  {resourceHealth.critical}
                </div>
                <div className="text-xs text-muted-foreground">Critical</div>
              </Link>

              <Link
                to={`${baseResourcesUrl}?health=orphaned`}
                className={cn(
                  "text-center p-2 rounded-lg border transition-colors hover:bg-muted/50 active:scale-95",
                  (resourceHealth.orphaned ?? 0) > 0
                    ? "bg-status-trivial/15 border-status-trivial/30"
                    : "bg-muted/50 border-border"
                )}
              >
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Unplug className="h-3.5 w-3.5 text-status-trivial" />
                </div>
                <div className={cn(
                  "text-lg font-semibold",
                  (resourceHealth.orphaned ?? 0) > 0 ? "text-status-trivial" : "text-muted-foreground"
                )}>
                  {resourceHealth.orphaned ?? 0}
                </div>
                <div className="text-xs text-muted-foreground">Orphaned</div>
              </Link>
            </div>
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
