import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, AlertCircle, TrendingUp, TrendingDown, Minus, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import type { EnhancedDashboardSummary } from "@/types";

interface OpenIssuesCardProps {
  summary: EnhancedDashboardSummary | undefined;
  isLoading?: boolean;
  previousCounts?: {
    critical: number;
    high: number;
  };
  accountId?: string;
}

export function OpenIssuesCard({ summary, isLoading, previousCounts, accountId }: OpenIssuesCardProps) {
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
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-muted" />
              <div className="space-y-2">
                <div className="h-6 w-24 bg-muted rounded" />
                <div className="h-4 w-32 bg-muted rounded" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { findingCounts } = summary;
  const criticalAndHigh = findingCounts.critical + findingCounts.high;
  const hasCritical = findingCounts.critical > 0;

  // Calculate trend
  const previousTotal = previousCounts
    ? previousCounts.critical + previousCounts.high
    : undefined;
  const trend = previousTotal !== undefined ? criticalAndHigh - previousTotal : undefined;

  // Determine urgency level
  const urgencyLevel = hasCritical ? "critical" : criticalAndHigh > 0 ? "warning" : "good";

  const urgencyConfig = {
    critical: {
      bgColor: "bg-red-500/10",
      borderColor: "border-red-500/30",
      iconColor: "text-red-500",
      icon: AlertCircle,
    },
    warning: {
      bgColor: "bg-orange-500/10",
      borderColor: "border-orange-500/30",
      iconColor: "text-orange-500",
      icon: AlertTriangle,
    },
    good: {
      bgColor: "bg-green-500/10",
      borderColor: "border-green-500/30",
      iconColor: "text-green-500",
      icon: AlertTriangle,
    },
  };

  const config = urgencyConfig[urgencyLevel];
  const UrgencyIcon = config.icon;

  const baseFindingsUrl = accountId ? `/accounts/${accountId}/findings` : "/findings";

  return (
    <Card className={cn("h-full transition-colors", config.borderColor, "border")}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          Open Issues
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-4">
          {/* Icon */}
          <div className={cn("relative h-12 w-12 rounded-full flex items-center justify-center", config.bgColor)}>
            <UrgencyIcon className={cn("h-5 w-5", config.iconColor)} />
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">
                {criticalAndHigh}
              </span>
              {trend !== undefined && trend !== 0 && (
                <span className={cn(
                  "flex items-center text-xs",
                  trend < 0 ? "text-green-500" : "text-red-500"
                )}>
                  {trend < 0 ? <TrendingDown className="h-3 w-3 mr-0.5" /> : <TrendingUp className="h-3 w-3 mr-0.5" />}
                  {trend > 0 ? "+" : ""}{trend}
                </span>
              )}
              {trend === 0 && previousTotal !== undefined && (
                <span className="flex items-center text-xs text-muted-foreground">
                  <Minus className="h-3 w-3 mr-0.5" />
                  No change
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {urgencyLevel === "good"
                ? "No critical or high severity issues"
                : `${findingCounts.critical > 0 ? `${findingCounts.critical} critical` : ""}${findingCounts.critical > 0 && findingCounts.high > 0 ? " + " : ""}${findingCounts.high > 0 ? `${findingCounts.high} high` : ""} severity`}
            </p>
          </div>
        </div>

        {/* Breakdown */}
        <div className="flex items-center gap-3 text-xs">
          {findingCounts.critical > 0 && (
            <Link
              to={`${baseFindingsUrl}?severity=critical&status=open`}
              className="flex items-center gap-1 text-red-500 hover:underline"
            >
              <span className="h-2 w-2 rounded-full bg-red-500" />
              {findingCounts.critical} Critical
              <ExternalLink className="h-3 w-3" />
            </Link>
          )}
          {findingCounts.high > 0 && (
            <Link
              to={`${baseFindingsUrl}?severity=high&status=open`}
              className="flex items-center gap-1 text-orange-500 hover:underline"
            >
              <span className="h-2 w-2 rounded-full bg-orange-500" />
              {findingCounts.high} High
              <ExternalLink className="h-3 w-3" />
            </Link>
          )}
          {findingCounts.medium > 0 && (
            <Link
              to={`${baseFindingsUrl}?severity=medium&status=open`}
              className="flex items-center gap-1 text-yellow-500 hover:underline"
            >
              <span className="h-2 w-2 rounded-full bg-yellow-500" />
              {findingCounts.medium} Med
              <ExternalLink className="h-3 w-3" />
            </Link>
          )}
          {findingCounts.low > 0 && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              {findingCounts.low} Low
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
