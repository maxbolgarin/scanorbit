import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileCheck, Award, MapPin, ShieldCheck, AlertTriangle, Clock, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import type { EnhancedDashboardSummary } from "@/types";

interface ComplianceStatusCardProps {
  summary: EnhancedDashboardSummary | undefined;
  isLoading?: boolean;
  accountId?: string;
}

export function ComplianceStatusCard({ summary, isLoading, accountId }: ComplianceStatusCardProps) {
  if (isLoading || !summary) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-foreground">
            Compliance Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-6 w-32 bg-muted rounded" />
              <div className="h-4 w-24 bg-muted rounded" />
            </div>
            <div className="h-2.5 w-full bg-muted rounded" />
            <div className="grid grid-cols-3 gap-2">
              <div className="h-20 bg-muted rounded" />
              <div className="h-20 bg-muted rounded" />
              <div className="h-20 bg-muted rounded" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { certificateInsights, complianceDetails, residencyViolations } = summary;
  const baseFindingsUrl = accountId ? `/accounts/${accountId}/findings` : "/overview/findings";

  // Certificate status
  const certStatus = certificateInsights.urgent > 0
    ? "critical"
    : certificateInsights.expiringSoon > 0
      ? "warning"
      : "good";

  const certStatusConfig = {
    critical: { color: "text-status-critical", bgColor: "bg-status-critical/15", borderColor: "border-status-critical/30" },
    warning: { color: "text-status-warning", bgColor: "bg-status-warning/15", borderColor: "border-status-warning/30" },
    good: { color: "text-status-info", bgColor: "bg-status-info/15", borderColor: "border-status-info/30" },
  };

  // Calculate compliance score (without tagging)
  const totalIssues = complianceDetails.residencyViolations + complianceDetails.securityIssues + certificateInsights.urgent;
  const overallStatus = totalIssues === 0 ? "compliant" : totalIssues <= 3 ? "partial" : "needs_work";

  const statusConfig = {
    compliant: { label: "Fully Compliant", color: "text-status-success" },
    partial: { label: "Mostly Compliant", color: "text-status-warning" },
    needs_work: { label: "Needs Attention", color: "text-status-critical" },
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-foreground flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCheck className="h-4 w-4" />
            Compliance Status
          </div>
          <Link
            to={`${baseFindingsUrl}?types=ssl_expiry,data_residency_violation,public_access,permissive_security_group,unencrypted_resource&status=open`}
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            View all
            <ExternalLink className="h-3 w-3" />
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Header row - matches ResourceHealth */}
        <div className="flex items-center justify-between">
          <div>
            <span className="text-2xl font-bold">{totalIssues}</span>
            <span className="text-sm text-muted-foreground ml-2">
              {totalIssues === 1 ? "issue" : "issues"}
            </span>
          </div>
          <span className={cn("text-sm font-medium", statusConfig[overallStatus].color)}>
            {statusConfig[overallStatus].label}
          </span>
        </div>

        {/* Distribution bar */}
        {totalIssues > 0 && (
          <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden flex">
            {certificateInsights.urgent > 0 && (
              <div
                className="h-full bg-status-warning transition-all"
                style={{ width: `${(certificateInsights.urgent / totalIssues) * 100}%` }}
                title={`${certificateInsights.urgent} Certificate issues`}
              />
            )}
            {complianceDetails.residencyViolations > 0 && (
              <div
                className="h-full bg-status-critical transition-all"
                style={{ width: `${(complianceDetails.residencyViolations / totalIssues) * 100}%` }}
                title={`${complianceDetails.residencyViolations} Residency violations`}
              />
            )}
            {complianceDetails.securityIssues > 0 && (
              <div
                className="h-full bg-status-high transition-all"
                style={{ width: `${(complianceDetails.securityIssues / totalIssues) * 100}%` }}
                title={`${complianceDetails.securityIssues} Security issues`}
              />
            )}
          </div>
        )}

        {/* Compliance metrics grid - 3 items */}
        <div className="grid grid-cols-3 gap-2">
          {/* Certificates */}
          <Link
            to={`${baseFindingsUrl}?type=ssl_expiry&status=open`}
            className={cn(
              "p-3 rounded-lg border transition-colors hover:bg-muted/50",
              certStatusConfig[certStatus].bgColor,
              certStatusConfig[certStatus].borderColor
            )}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <Award className={cn("h-4 w-4", certStatusConfig[certStatus].color)} />
              <span className="text-xs text-muted-foreground">Certificates</span>
            </div>
            <div className={cn("text-lg font-semibold", certStatusConfig[certStatus].color)}>
              {certificateInsights.healthy}/{certificateInsights.total}
            </div>
            {certificateInsights.urgent > 0 && (
              <span className="text-xs text-status-critical flex items-center gap-1 mt-1">
                <AlertTriangle className="h-3 w-3" />
                {certificateInsights.urgent} urgent
              </span>
            )}
            {certificateInsights.urgent === 0 && certificateInsights.expiringSoon > 0 && (
              <span className="text-xs text-status-warning flex items-center gap-1 mt-1">
                <Clock className="h-3 w-3" />
                {certificateInsights.expiringSoon} soon
              </span>
            )}
          </Link>

          {/* Data Residency */}
          <Link
            to={`${baseFindingsUrl}?type=data_residency_violation&status=open`}
            className={cn(
              "p-3 rounded-lg border transition-colors hover:bg-muted/50",
              residencyViolations > 0
                ? "bg-status-critical/15 border-status-critical/30"
                : "bg-status-success/15 border-status-success/30"
            )}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <MapPin className={cn(
                "h-4 w-4",
                residencyViolations > 0 ? "text-status-critical" : "text-status-success"
              )} />
              <span className="text-xs text-muted-foreground">Residency</span>
            </div>
            <div className={cn(
              "text-lg font-semibold",
              residencyViolations > 0 ? "text-status-critical" : "text-status-success"
            )}>
              {residencyViolations > 0 ? residencyViolations : "OK"}
            </div>
            {residencyViolations > 0 && (
              <span className="text-xs text-status-critical mt-1">violations</span>
            )}
          </Link>

          {/* Security Compliance */}
          <Link
            to={`${baseFindingsUrl}?types=public_access,permissive_security_group,unencrypted_resource&status=open`}
            className={cn(
              "p-3 rounded-lg border transition-colors hover:bg-muted/50",
              complianceDetails.securityIssues > 0
                ? "bg-status-high/15 border-status-high/30"
                : "bg-status-success/15 border-status-success/30"
            )}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <ShieldCheck className={cn(
                "h-4 w-4",
                complianceDetails.securityIssues > 0 ? "text-status-high" : "text-status-success"
              )} />
              <span className="text-xs text-muted-foreground">Security</span>
            </div>
            <div className={cn(
              "text-lg font-semibold",
              complianceDetails.securityIssues > 0 ? "text-status-high" : "text-status-success"
            )}>
              {complianceDetails.securityIssues > 0 ? complianceDetails.securityIssues : "OK"}
            </div>
            {complianceDetails.securityIssues > 0 && (
              <span className="text-xs text-status-high mt-1">issues</span>
            )}
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
