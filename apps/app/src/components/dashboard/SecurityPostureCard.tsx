import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import type { EnhancedDashboardSummary } from "@/types";

interface SecurityPostureCardProps {
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
    label: "Medium",
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

export function SecurityPostureCard({ summary, isLoading, accountId }: SecurityPostureCardProps) {
  if (isLoading || !summary) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Security Posture
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-6 w-32 bg-muted rounded" />
            <div className="h-3 w-full bg-muted rounded" />
            <div className="flex gap-4">
              <div className="h-4 w-16 bg-muted rounded" />
              <div className="h-4 w-16 bg-muted rounded" />
              <div className="h-4 w-16 bg-muted rounded" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { findingCounts } = summary;
  const total = findingCounts.total;
  const baseFindingsUrl = accountId ? `/accounts/${accountId}/findings` : "/overview/findings";

  // Calculate percentages for the bar
  const percentages = {
    critical: total > 0 ? (findingCounts.critical / total) * 100 : 0,
    high: total > 0 ? (findingCounts.high / total) * 100 : 0,
    medium: total > 0 ? (findingCounts.medium / total) * 100 : 0,
    low: total > 0 ? (findingCounts.low / total) * 100 : 0,
    trivial: total > 0 ? (findingCounts.trivial / total) * 100 : 0,
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
    critical: { text: "Needs Immediate Attention", color: "text-red-500" },
    warning: { text: "Action Required", color: "text-orange-500" },
    fair: { text: "Stable", color: "text-yellow-500" },
    good: { text: "Excellent", color: "text-green-500" },
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Security Posture
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
      <CardContent className="space-y-4">
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

        {/* Severity distribution bar */}
        {total > 0 ? (
          <div className="space-y-2">
            <div className="h-3 w-full bg-muted rounded-full overflow-hidden flex">
              {(["critical", "high", "medium", "low", "trivial"] as const).map((severity) => {
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

            {/* Legend */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {(["critical", "high", "medium", "low", "trivial"] as const).map((severity) => {
                const count = findingCounts[severity];
                if (count === 0) return null;
                return (
                  <Link
                    key={severity}
                    to={`${baseFindingsUrl}?severity=${severity}&status=open`}
                    className={cn(
                      "flex items-center gap-1.5 hover:underline",
                      severityConfig[severity].textColor
                    )}
                  >
                    <span className={cn("h-2 w-2 rounded-full", severityConfig[severity].color)} />
                    <span>{count} {severityConfig[severity].label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="text-center py-4 text-sm text-muted-foreground">
            No open findings. Great job! 🎉
          </div>
        )}
      </CardContent>
    </Card>
  );
}
