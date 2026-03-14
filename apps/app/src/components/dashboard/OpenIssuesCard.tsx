import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, ExternalLink, AlertCircle, AlertOctagon, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link, useNavigate } from "react-router-dom";
import type { EnhancedDashboardSummary } from "@/types";
import { useViewingSettingsStore } from "@/stores/settings-store";

interface OpenIssuesCardProps {
  summary: EnhancedDashboardSummary | undefined;
  isLoading?: boolean;
  accountId?: string;
}

const severityConfig = {
  critical: {
    label: "Critical",
    shortLabel: "Crit",
    color: "bg-status-critical",
    textColor: "text-status-critical",
  },
  high: {
    label: "High",
    shortLabel: "High",
    color: "bg-status-high",
    textColor: "text-status-high",
  },
  medium: {
    label: "Med",
    shortLabel: "Med",
    color: "bg-status-warning",
    textColor: "text-status-warning",
  },
  low: {
    label: "Low",
    shortLabel: "Low",
    color: "bg-status-info",
    textColor: "text-status-info",
  },
  trivial: {
    label: "Trivial",
    shortLabel: "Triv",
    color: "bg-status-trivial",
    textColor: "text-status-trivial",
  },
};

export function OpenIssuesCard({ summary, isLoading, accountId }: OpenIssuesCardProps) {
  const navigate = useNavigate();
  const updateSettings = useViewingSettingsStore((state) => state.updateSettings);

  if (isLoading || !summary) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-foreground">
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
    critical: { text: "Needs Attention", color: "text-status-critical" },
    warning: { text: "Action Required", color: "text-status-high" },
    fair: { text: "Stable", color: "text-status-warning" },
    good: { text: "Excellent", color: "text-status-success" },
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-foreground flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Open Issues
          </div>
          <button
            onClick={() => {
              updateSettings({ hideTrivial: true });
              navigate(`${baseFindingsUrl}?status=open`);
            }}
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            View all
            <ExternalLink className="h-3 w-3" />
          </button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Total findings and status */}
        <div className="flex items-center justify-between">
          <div>
            <span className="text-2xl font-bold">{total}</span>
            <span className="text-sm text-muted-foreground ml-2">non-trivial findings</span>
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
          <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
            {/* Critical */}
            <Link
              to={`${baseFindingsUrl}?severity=critical&status=open`}
              className={cn(
                "text-center p-1.5 sm:p-2 rounded-lg border transition-colors hover:bg-muted/50 active:scale-95",
                findingCounts.critical > 0
                  ? "bg-status-critical/15 border-status-critical/30"
                  : "bg-muted/50 border-border"
              )}
            >
              <div className="flex items-center justify-center gap-1 mb-1">
                <AlertOctagon className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-status-critical" />
              </div>
              <div className={cn(
                "text-base sm:text-lg font-semibold",
                findingCounts.critical > 0 ? "text-status-critical" : "text-muted-foreground"
              )}>
                {findingCounts.critical}
              </div>
              <div className="text-[10px] sm:text-xs text-muted-foreground">
                <span className="sm:hidden">Crit</span>
                <span className="hidden sm:inline">Critical</span>
              </div>
            </Link>

            {/* High */}
            <Link
              to={`${baseFindingsUrl}?severity=high&status=open`}
              className={cn(
                "text-center p-1.5 sm:p-2 rounded-lg border transition-colors hover:bg-muted/50 active:scale-95",
                findingCounts.high > 0
                  ? "bg-status-high/15 border-status-high/30"
                  : "bg-muted/50 border-border"
              )}
            >
              <div className="flex items-center justify-center gap-1 mb-1">
                <AlertCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-status-high" />
              </div>
              <div className={cn(
                "text-base sm:text-lg font-semibold",
                findingCounts.high > 0 ? "text-status-high" : "text-muted-foreground"
              )}>
                {findingCounts.high}
              </div>
              <div className="text-[10px] sm:text-xs text-muted-foreground">High</div>
            </Link>

            {/* Medium */}
            <Link
              to={`${baseFindingsUrl}?severity=medium&status=open`}
              className={cn(
                "text-center p-1.5 sm:p-2 rounded-lg border transition-colors hover:bg-muted/50 active:scale-95",
                findingCounts.medium > 0
                  ? "bg-status-warning/15 border-status-warning/30"
                  : "bg-muted/50 border-border"
              )}
            >
              <div className="flex items-center justify-center gap-1 mb-1">
                <AlertTriangle className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-status-warning" />
              </div>
              <div className={cn(
                "text-base sm:text-lg font-semibold",
                findingCounts.medium > 0 ? "text-status-warning" : "text-muted-foreground"
              )}>
                {findingCounts.medium}
              </div>
              <div className="text-[10px] sm:text-xs text-muted-foreground">Med</div>
            </Link>

            {/* Low */}
            <Link
              to={`${baseFindingsUrl}?severity=low&status=open`}
              className={cn(
                "text-center p-1.5 sm:p-2 rounded-lg border transition-colors hover:bg-muted/50 active:scale-95",
                findingCounts.low > 0
                  ? "bg-status-info/15 border-status-info/30"
                  : "bg-muted/50 border-border"
              )}
            >
              <div className="flex items-center justify-center gap-1 mb-1">
                <Info className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-status-info" />
              </div>
              <div className={cn(
                "text-base sm:text-lg font-semibold",
                findingCounts.low > 0 ? "text-status-info" : "text-muted-foreground"
              )}>
                {findingCounts.low}
              </div>
              <div className="text-[10px] sm:text-xs text-muted-foreground">Low</div>
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
