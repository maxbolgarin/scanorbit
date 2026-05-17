import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EnhancedDashboardSummary } from "@/types";

interface HealthScoreCardProps {
  summary: EnhancedDashboardSummary | undefined;
  isLoading?: boolean;
  previousScore?: number;
}

const statusConfig = {
  excellent: {
    label: "Excellent",
    color: "text-status-success",
    bgColor: "bg-status-success/15",
    borderColor: "border-status-success/40",
    progressColor: "bg-status-success",
  },
  good: {
    label: "Good",
    color: "text-status-info",
    bgColor: "bg-status-info/15",
    borderColor: "border-status-info/40",
    progressColor: "bg-status-info",
  },
  fair: {
    label: "Fair",
    color: "text-status-warning",
    bgColor: "bg-status-warning/15",
    borderColor: "border-status-warning/40",
    progressColor: "bg-status-warning",
  },
  needs_attention: {
    label: "Needs Attention",
    color: "text-status-critical",
    bgColor: "bg-status-critical/15",
    borderColor: "border-status-critical/40",
    progressColor: "bg-status-critical",
  },
};

const categoryLabels: Record<string, { full: string; short: string }> = {
  security: { full: "Security", short: "Security" },
  compliance: { full: "Compliance", short: "Compliance" },
  costEfficiency: { full: "Cost Efficiency", short: "Cost" },
};

export function HealthScoreCard({ summary, isLoading, previousScore }: HealthScoreCardProps) {
  if (isLoading || !summary) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-foreground">
            Infrastructure Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-muted" />
              <div className="space-y-2">
                <div className="h-6 w-20 bg-muted rounded" />
                <div className="h-4 w-32 bg-muted rounded" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-2 w-full bg-muted rounded" />
              <div className="h-2 w-full bg-muted rounded" />
              <div className="h-2 w-full bg-muted rounded" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { healthScores, healthStatus, issuesToResolve } = summary;
  const config = statusConfig[healthStatus];

  // Calculate trend
  const trend = previousScore !== undefined ? healthScores.overall - previousScore : 0;

  return (
    <Card className={cn("h-full transition-colors", config.borderColor, "border")}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Shield className="h-4 w-4" />
          <span className="sm:hidden">Health</span>
          <span className="hidden sm:inline">Infrastructure Health</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 sm:space-y-4">
        {/* Score and Status */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Circular Score - SVG donut */}
          <div className="relative h-16 w-16 sm:h-20 sm:w-20 flex-shrink-0 flex items-center justify-center">
            <svg className="absolute h-full w-full -rotate-90" viewBox="0 0 80 80">
              <circle
                cx="40"
                cy="40"
                r="34"
                stroke="currentColor"
                strokeWidth="6"
                fill="none"
                className="text-muted"
              />
              <circle
                cx="40"
                cy="40"
                r="34"
                stroke="currentColor"
                strokeWidth="6"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${healthScores.overall * 2.136} 213.6`}
                className={config.color}
              />
            </svg>
            <div className="z-10 text-center">
              <div className={cn("text-xl sm:text-2xl font-bold", config.color)}>
                {healthScores.overall}
              </div>
            </div>
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className={cn("text-base sm:text-lg font-semibold", config.color)}>
                {config.label}
              </span>
              {trend !== 0 && (
                <span className={cn(
                  "flex items-center text-xs",
                  trend > 0 ? "text-status-success" : "text-status-critical"
                )}>
                  {trend > 0 ? <TrendingUp className="h-3 w-3 mr-0.5" /> : <TrendingDown className="h-3 w-3 mr-0.5" />}
                  {trend > 0 ? "+" : ""}{trend}
                </span>
              )}
              {trend === 0 && previousScore !== undefined && (
                <span className="flex items-center text-xs text-muted-foreground">
                  <Minus className="h-3 w-3 mr-0.5" />
                  No change
                </span>
              )}
            </div>
            {issuesToResolve > 0 ? (
              <p className="text-xs text-muted-foreground mt-0.5">
                Resolve {issuesToResolve} issue{issuesToResolve > 1 ? "s" : ""} to improve
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-0.5">
                Great job! Keep monitoring
              </p>
            )}
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="space-y-1.5 sm:space-y-2">
          {(["security", "compliance", "costEfficiency"] as const).map((category) => {
            const score = healthScores[category];
            const progressColor = score >= 90 ? "bg-status-success" : score >= 70 ? "bg-status-info" : score >= 50 ? "bg-status-warning" : "bg-status-critical";

            return (
              <div key={category} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    <span className="sm:hidden">{categoryLabels[category].short}</span>
                    <span className="hidden sm:inline">{categoryLabels[category].full}</span>
                  </span>
                  <span className="font-medium">{score}%</span>
                </div>
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", progressColor)}
                    style={{ width: `${score}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
