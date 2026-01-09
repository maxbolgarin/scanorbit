import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import type { DashboardSummary } from "@/types";
import {
  Server,
  HardDrive,
  Shield,
  Globe,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
} from "lucide-react";

interface DashboardSummaryCardsProps {
  summary: DashboardSummary | undefined;
  isLoading?: boolean;
}

export function DashboardSummaryCards({ summary, isLoading }: DashboardSummaryCardsProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-4 w-20 rounded bg-muted" />
              <div className="mt-2 h-8 w-16 rounded bg-muted" />
              <div className="mt-2 h-3 w-24 rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!summary) return null;

  const hasOrphanedIssues = summary.orphanedResources > 0;
  const hasCertificateIssues = summary.expiringCertificates > 0;
  const hasResidencyIssues = summary.residencyViolations > 0;
  const urgentCertificates = summary.urgentCertificates || 0;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Total Resources */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">
                Total Resources
              </p>
              <p className="text-3xl font-bold">
                {(summary.totalResources || 0).toLocaleString()}
              </p>
              {summary.resourcesTrend !== 0 && (
                <div className={`flex items-center gap-1 text-xs ${summary.resourcesTrend > 0 ? "text-green-600" : "text-orange-600"}`}>
                  {summary.resourcesTrend > 0 ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  <span>
                    {summary.resourcesTrend > 0 ? "+" : ""}{summary.resourcesTrend} from last scan
                  </span>
                </div>
              )}
            </div>
            <div className="rounded-full bg-blue-500/10 p-3">
              <Server className="h-6 w-6 text-blue-500" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Orphaned Resources */}
      <Card className={hasOrphanedIssues ? "border-orange-200 dark:border-orange-900" : ""}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">
                Orphaned Resources
              </p>
              <p className={`text-3xl font-bold ${hasOrphanedIssues ? "text-orange-600" : ""}`}>
                {summary.orphanedResources || 0}
              </p>
              {hasOrphanedIssues && summary.orphanedSavings > 0 && (
                <p className="text-xs text-green-600">
                  Save {formatCurrency(summary.orphanedSavings)}/month
                </p>
              )}
              {!hasOrphanedIssues && (
                <p className="text-xs text-muted-foreground">No waste detected</p>
              )}
            </div>
            <div className={`rounded-full p-3 ${hasOrphanedIssues ? "bg-orange-500/10" : "bg-muted"}`}>
              <HardDrive className={`h-6 w-6 ${hasOrphanedIssues ? "text-orange-500" : "text-muted-foreground"}`} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Expiring Certificates */}
      <Card className={urgentCertificates > 0 ? "border-red-200 dark:border-red-900" : hasCertificateIssues ? "border-yellow-200 dark:border-yellow-900" : ""}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">
                Expiring Certificates
              </p>
              <p className={`text-3xl font-bold ${urgentCertificates > 0 ? "text-red-600" : hasCertificateIssues ? "text-yellow-600" : ""}`}>
                {summary.expiringCertificates || 0}
              </p>
              {urgentCertificates > 0 && (
                <div className="flex items-center gap-1 text-xs text-red-600">
                  <AlertTriangle className="h-3 w-3" />
                  <span>{urgentCertificates} expire in &lt;7 days</span>
                </div>
              )}
              {!hasCertificateIssues && (
                <p className="text-xs text-muted-foreground">All certificates valid</p>
              )}
            </div>
            <div className={`rounded-full p-3 ${urgentCertificates > 0 ? "bg-red-500/10" : hasCertificateIssues ? "bg-yellow-500/10" : "bg-muted"}`}>
              <Shield className={`h-6 w-6 ${urgentCertificates > 0 ? "text-red-500" : hasCertificateIssues ? "text-yellow-500" : "text-muted-foreground"}`} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Residency Violations */}
      <Card className={hasResidencyIssues ? "border-red-200 dark:border-red-900" : ""}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">
                Residency Violations
              </p>
              <p className={`text-3xl font-bold ${hasResidencyIssues ? "text-red-600" : ""}`}>
                {summary.residencyViolations || 0}
              </p>
              {hasResidencyIssues ? (
                <p className="text-xs text-red-600">Non-compliant resources</p>
              ) : (
                <p className="text-xs text-muted-foreground">All resources compliant</p>
              )}
            </div>
            <div className={`rounded-full p-3 ${hasResidencyIssues ? "bg-red-500/10" : "bg-muted"}`}>
              <Globe className={`h-6 w-6 ${hasResidencyIssues ? "text-red-500" : "text-muted-foreground"}`} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
