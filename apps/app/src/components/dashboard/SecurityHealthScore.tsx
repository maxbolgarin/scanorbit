import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { DashboardSummary } from "@/types";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";

interface SecurityHealthScoreProps {
  summary: DashboardSummary | undefined;
  isLoading?: boolean;
  hasAccounts?: boolean;
  hasScanInProgress?: boolean;
}

export function SecurityHealthScore({ summary, isLoading, hasAccounts, hasScanInProgress }: SecurityHealthScoreProps) {
  // Don't show if no accounts connected
  if (!hasAccounts) {
    return null;
  }

  // Don't show if scan is in progress and we have no data yet
  if (hasScanInProgress && (!summary || summary.totalResources === 0)) {
    return null;
  }

  // Don't show if we have no resources (no completed scan)
  if (!isLoading && (!summary || summary.totalResources === 0)) {
    return null;
  }

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardHeader className="pb-2">
          <div className="h-5 w-32 rounded bg-muted" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className="h-24 w-24 rounded-full bg-muted" />
            <div className="space-y-2">
              <div className="h-4 w-48 rounded bg-muted" />
              <div className="h-4 w-36 rounded bg-muted" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!summary) return null;

  // Calculate health score (0-100)
  // Deduct points for issues
  const totalResources = summary.totalResources || 0;
  const orphanedPenalty = Math.min((summary.orphanedResources || 0) * 2, 20);
  const certPenalty = Math.min((summary.expiringCertificates || 0) * 5, 25);
  const urgentCertPenalty = (summary.urgentCertificates || 0) * 10;
  const residencyPenalty = Math.min((summary.residencyViolations || 0) * 10, 30);

  const baseScore = 100;
  const healthScore = Math.max(0, baseScore - orphanedPenalty - certPenalty - urgentCertPenalty - residencyPenalty);

  // Determine health status
  const getHealthStatus = (score: number) => {
    if (score >= 90) return { label: "Excellent", color: "text-status-success", bgColor: "bg-status-success", Icon: ShieldCheck };
    if (score >= 70) return { label: "Good", color: "text-status-info", bgColor: "bg-status-info", Icon: Shield };
    if (score >= 50) return { label: "Fair", color: "text-status-warning", bgColor: "bg-status-warning", Icon: ShieldAlert };
    return { label: "Needs Attention", color: "text-status-critical", bgColor: "bg-status-critical", Icon: ShieldX };
  };

  const status = getHealthStatus(healthScore);
  const StatusIcon = status.Icon;

  // Calculate trend (mock for now - could be based on historical data)
  const trend = summary.resourcesTrend || 0;
  const TrendIcon = trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus;

  // Health breakdown items
  const breakdownItems = [
    {
      label: "Orphaned Resources",
      value: summary.orphanedResources || 0,
      max: totalResources,
      impact: orphanedPenalty,
      status: (summary.orphanedResources || 0) === 0 ? "good" : "warning",
    },
    {
      label: "Certificate Issues",
      value: summary.expiringCertificates || 0,
      max: 10,
      impact: certPenalty + urgentCertPenalty,
      status: (summary.expiringCertificates || 0) === 0 ? "good" : (summary.urgentCertificates || 0) > 0 ? "critical" : "warning",
    },
    {
      label: "Compliance Violations",
      value: summary.residencyViolations || 0,
      max: 10,
      impact: residencyPenalty,
      status: (summary.residencyViolations || 0) === 0 ? "good" : "critical",
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-medium">
          <Shield className="h-5 w-5" />
          Infrastructure Health
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          {/* Score Circle */}
          <div className="relative flex h-28 w-28 flex-shrink-0 items-center justify-center">
            {/* Background circle */}
            <svg className="absolute h-full w-full -rotate-90">
              <circle
                cx="56"
                cy="56"
                r="48"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                className="text-muted"
              />
              <circle
                cx="56"
                cy="56"
                r="48"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${healthScore * 3.01} 301`}
                className={status.color}
              />
            </svg>
            {/* Score text */}
            <div className="z-10 text-center">
              <div className={`text-3xl font-bold ${status.color}`}>{healthScore}</div>
              <div className="text-xs text-muted-foreground">/ 100</div>
            </div>
          </div>

          {/* Status and breakdown */}
          <div className="flex-1 space-y-4">
            {/* Status label */}
            <div className="flex items-center gap-3">
              <div className={`rounded-full p-2 ${status.bgColor}/10`}>
                <StatusIcon className={`h-5 w-5 ${status.color}`} />
              </div>
              <div>
                <p className={`text-lg font-semibold ${status.color}`}>{status.label}</p>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <TrendIcon className="h-3 w-3" />
                  <span>
                    {trend === 0 ? "No change" : trend > 0 ? `${trend} new resources` : `${Math.abs(trend)} resources removed`}
                  </span>
                </div>
              </div>
            </div>

            {/* Breakdown */}
            <div className="space-y-2">
              {breakdownItems.map((item) => (
                <div key={item.label} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{item.label}</span>
                  <div className="flex items-center gap-2">
                    <span
                      className={
                        item.status === "good"
                          ? "text-status-success"
                          : item.status === "critical"
                            ? "text-status-critical"
                            : "text-status-warning"
                      }
                    >
                      {item.value}
                    </span>
                    {item.impact > 0 && (
                      <span className="text-xs text-muted-foreground">(-{item.impact})</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
