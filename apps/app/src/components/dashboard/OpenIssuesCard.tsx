import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, ExternalLink, AlertCircle, AlertOctagon, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import type { EnhancedDashboardSummary } from "@/types";

interface OpenIssuesCardProps {
  summary: EnhancedDashboardSummary | undefined;
  isLoading?: boolean;
  accountId?: string;
}

const severityConfig = {
  critical: {
    label: "Critical",
    color: "bg-red-500",
    textColor: "text-red-500",
  },
  high: {
    label: "High",
    color: "bg-orange-500",
    textColor: "text-orange-500",
  },
  medium: {
    label: "Med",
    color: "bg-yellow-500",
    textColor: "text-yellow-500",
  },
  low: {
    label: "Low",
    color: "bg-blue-500",
    textColor: "text-blue-500",
  },
  trivial: {
    label: "Trivial",
    color: "bg-slate-400",
    textColor: "text-slate-400",
  },
};

export function OpenIssuesCard({ summary, isLoading, accountId }: OpenIssuesCardProps) {
  if (isLoading || !summary) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Open Issues
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-6 w-32 bg-muted rounded" />
              <div className="h-4 w-24 bg-muted rounded" />
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

  const { findingCounts } = summary;
  // Exclude trivial from total - only count actionable findings
  const total = findingCounts.critical + findingCounts.high + findingCounts.medium + findingCounts.low;
  const baseFindingsUrl = accountId ? `/accounts/${accountId}/findings` : "/overview/findings";

  // Calculate percentages for the bar (excluding trivial)
  const percentages = {
    critical: total > 0 ? (findingCounts.critical / total) * 100 : 0,
    high: total > 0 ? (findingCounts.high / total) * 100 : 0,
    medium: total > 0 ? (findingCounts.medium / total) * 100 : 0,
    low: total > 0 ? (findingCounts.low / total) * 100 : 0,
  };

  // Determine overall status
  const status = findingCounts.critical > 0
    ? "critical"
    : findingCounts.high > 0
      ? "warning"
      : total > 0
        ? "fair"
        : "good";

  const statusConfig = {
    critical: { text: "Needs Attention", color: "text-red-500" },
    warning: { text: "Action Required", color: "text-orange-500" },
    fair: { text: "Stable", color: "text-yellow-500" },
    good: { text: "Excellent", color: "text-green-500" },
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Open Issues
          </div>
          <Link
            to={`${baseFindingsUrl}?status=open`}
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            View all
            <ExternalLink className="h-3 w-3" />
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Total findings and status */}
        <div className="flex items-center justify-between">
          <div>
            <span className="text-2xl font-bold">{total}</span>
            <span className="text-sm text-muted-foreground ml-2">open findings</span>
          </div>
          <span className={cn("text-sm font-medium", statusConfig[status].color)}>
            {statusConfig[status].text}
          </span>
        </div>

        {/* Severity distribution bar (excluding trivial) */}
        {total > 0 && (
          <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden flex">
            {(["critical", "high", "medium", "low"] as const).map((severity) => {
              const percentage = percentages[severity];
              if (percentage === 0) return null;
              return (
                <div
                  key={severity}
                  className={cn("h-full transition-all", severityConfig[severity].color)}
                  style={{ width: `${percentage}%` }}
                  title={`${findingCounts[severity]} ${severityConfig[severity].label}`}
                />
              );
            })}
          </div>
        )}

        {/* Severity breakdown grid - visual boxes like ResourceHealth */}
        {total > 0 ? (
          <div className="grid grid-cols-4 gap-2">
            {/* Critical */}
            <Link
              to={`${baseFindingsUrl}?severity=critical&status=open`}
              className={cn(
                "text-center p-2 rounded-lg border transition-colors hover:bg-muted/50",
                findingCounts.critical > 0
                  ? "bg-red-500/10 border-red-500/20"
                  : "bg-muted/50 border-border"
              )}
            >
              <div className="flex items-center justify-center gap-1 mb-1">
                <AlertOctagon className="h-3.5 w-3.5 text-red-500" />
              </div>
              <div className={cn(
                "text-lg font-semibold",
                findingCounts.critical > 0 ? "text-red-500" : "text-muted-foreground"
              )}>
                {findingCounts.critical}
              </div>
              <div className="text-xs text-muted-foreground">Critical</div>
            </Link>

            {/* High */}
            <Link
              to={`${baseFindingsUrl}?severity=high&status=open`}
              className={cn(
                "text-center p-2 rounded-lg border transition-colors hover:bg-muted/50",
                findingCounts.high > 0
                  ? "bg-orange-500/10 border-orange-500/20"
                  : "bg-muted/50 border-border"
              )}
            >
              <div className="flex items-center justify-center gap-1 mb-1">
                <AlertCircle className="h-3.5 w-3.5 text-orange-500" />
              </div>
              <div className={cn(
                "text-lg font-semibold",
                findingCounts.high > 0 ? "text-orange-500" : "text-muted-foreground"
              )}>
                {findingCounts.high}
              </div>
              <div className="text-xs text-muted-foreground">High</div>
            </Link>

            {/* Medium */}
            <Link
              to={`${baseFindingsUrl}?severity=medium&status=open`}
              className={cn(
                "text-center p-2 rounded-lg border transition-colors hover:bg-muted/50",
                findingCounts.medium > 0
                  ? "bg-yellow-500/10 border-yellow-500/20"
                  : "bg-muted/50 border-border"
              )}
            >
              <div className="flex items-center justify-center gap-1 mb-1">
                <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />
              </div>
              <div className={cn(
                "text-lg font-semibold",
                findingCounts.medium > 0 ? "text-yellow-500" : "text-muted-foreground"
              )}>
                {findingCounts.medium}
              </div>
              <div className="text-xs text-muted-foreground">Medium</div>
            </Link>

            {/* Low */}
            <Link
              to={`${baseFindingsUrl}?severity=low&status=open`}
              className={cn(
                "text-center p-2 rounded-lg border transition-colors hover:bg-muted/50",
                findingCounts.low > 0
                  ? "bg-blue-500/10 border-blue-500/20"
                  : "bg-muted/50 border-border"
              )}
            >
              <div className="flex items-center justify-center gap-1 mb-1">
                <Info className="h-3.5 w-3.5 text-blue-500" />
              </div>
              <div className={cn(
                "text-lg font-semibold",
                findingCounts.low > 0 ? "text-blue-500" : "text-muted-foreground"
              )}>
                {findingCounts.low}
              </div>
              <div className="text-xs text-muted-foreground">Low</div>
            </Link>
          </div>
        ) : (
          <div className="text-center py-2 text-sm text-muted-foreground">
            No open issues
          </div>
        )}
      </CardContent>
    </Card>
  );
}
