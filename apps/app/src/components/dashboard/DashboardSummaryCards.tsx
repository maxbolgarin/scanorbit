import { useNavigate } from "react-router-dom";
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
  const navigate = useNavigate();

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
              <p className="text-sm font-semibold text-muted-foreground">
                Total Resources
              </p>
              <p className="text-3xl font-bold">
                {(summary.totalResources || 0).toLocaleString()}
              </p>
              {summary.resourcesTrend !== 0 && (
                <div className={`flex items-center gap-1 text-xs ${summary.resourcesTrend > 0 ? "text-status-success" : "text-status-high"}`}>
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
            <div className="rounded-full bg-muted p-3">
              <Server className="h-6 w-6 text-muted-foreground" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Orphaned Resources */}
      <Card
        className="cursor-pointer transition-colors hover:border-primary/50"
        onClick={() => navigate("/findings?category=orphaned")}
      >
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-muted-foreground">
                Orphaned Resources
              </p>
              <p className={`text-3xl font-bold ${hasOrphanedIssues ? "text-status-high" : ""}`}>
                {summary.orphanedResources || 0}
              </p>
              {hasOrphanedIssues && summary.orphanedSavings > 0 && (
                <p className="text-xs text-status-success">
                  Save {formatCurrency(summary.orphanedSavings)}/month
                </p>
              )}
              {!hasOrphanedIssues && (
                <p className="text-xs text-muted-foreground">No waste detected</p>
              )}
            </div>
            <div className={`rounded-full p-3 ${hasOrphanedIssues ? "bg-muted" : "bg-muted"}`}>
              <HardDrive className={`h-6 w-6 ${hasOrphanedIssues ? "text-status-high" : "text-muted-foreground"}`} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Expiring Certificates */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-muted-foreground">
                Expiring Certificates
              </p>
              <p className={`text-3xl font-bold ${urgentCertificates > 0 ? "text-status-critical" : hasCertificateIssues ? "text-status-warning" : ""}`}>
                {summary.expiringCertificates || 0}
              </p>
              {urgentCertificates > 0 && (
                <div className="flex items-center gap-1 text-xs text-status-critical">
                  <AlertTriangle className="h-3 w-3" />
                  <span>{urgentCertificates} expire in &lt;7 days</span>
                </div>
              )}
              {!hasCertificateIssues && (
                <p className="text-xs text-muted-foreground">All certificates valid</p>
              )}
            </div>
            <div className={`rounded-full p-3 ${urgentCertificates > 0 ? "bg-muted" : hasCertificateIssues ? "bg-muted" : "bg-muted"}`}>
              <Shield className={`h-6 w-6 ${urgentCertificates > 0 ? "text-status-critical" : hasCertificateIssues ? "text-status-warning" : "text-muted-foreground"}`} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Residency Violations */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-muted-foreground">
                Residency Violations
              </p>
              <p className={`text-3xl font-bold ${hasResidencyIssues ? "text-status-critical" : ""}`}>
                {summary.residencyViolations || 0}
              </p>
              {hasResidencyIssues ? (
                <p className="text-xs text-status-critical">Non-compliant resources</p>
              ) : (
                <p className="text-xs text-muted-foreground">All resources compliant</p>
              )}
            </div>
            <div className={`rounded-full p-3 ${hasResidencyIssues ? "bg-muted" : "bg-muted"}`}>
              <Globe className={`h-6 w-6 ${hasResidencyIssues ? "text-status-critical" : "text-muted-foreground"}`} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
