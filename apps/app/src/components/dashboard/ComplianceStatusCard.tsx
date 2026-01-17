import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileCheck, Award, MapPin, Tag, ShieldCheck, AlertTriangle, Clock } from "lucide-react";
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
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Compliance Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="grid grid-cols-2 gap-3">
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

  const { certificateInsights, complianceDetails, residencyViolations } = summary;
  const baseFindingsUrl = accountId ? `/accounts/${accountId}/findings` : "/findings";

  // Certificate status
  const certStatus = certificateInsights.urgent > 0
    ? "critical"
    : certificateInsights.expiringSoon > 0
      ? "warning"
      : "good";

  const certStatusConfig = {
    critical: { color: "text-red-500", bgColor: "bg-red-500/10", borderColor: "border-red-500/20" },
    warning: { color: "text-yellow-500", bgColor: "bg-yellow-500/10", borderColor: "border-yellow-500/20" },
    good: { color: "text-green-500", bgColor: "bg-green-500/10", borderColor: "border-green-500/20" },
  };

  // Calculate compliance score
  const totalIssues = complianceDetails.residencyViolations + complianceDetails.missingTags + complianceDetails.securityIssues;
  const overallStatus = totalIssues === 0 ? "compliant" : totalIssues <= 5 ? "partial" : "needs_work";

  const statusConfig = {
    compliant: { label: "Fully Compliant", color: "text-green-500" },
    partial: { label: "Mostly Compliant", color: "text-yellow-500" },
    needs_work: { label: "Needs Attention", color: "text-red-500" },
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCheck className="h-4 w-4" />
            Compliance Status
          </div>
          <span className={cn("text-xs font-medium", statusConfig[overallStatus].color)}>
            {statusConfig[overallStatus].label}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Compliance metrics grid */}
        <div className="grid grid-cols-2 gap-2">
          {/* Certificates */}
          <Link
            to={`${baseFindingsUrl}?type=ssl_expiry&status=open`}
            className={cn(
              "p-3 rounded-lg border transition-colors hover:bg-muted/50",
              certStatusConfig[certStatus].bgColor,
              certStatusConfig[certStatus].borderColor
            )}
          >
            <div className="flex items-center gap-2 mb-1">
              <Award className={cn("h-4 w-4", certStatusConfig[certStatus].color)} />
              <span className="text-xs text-muted-foreground">Certificates</span>
            </div>
            <div className="flex items-center justify-between">
              <span className={cn("text-lg font-semibold", certStatusConfig[certStatus].color)}>
                {certificateInsights.healthy}/{certificateInsights.total}
              </span>
              {certificateInsights.urgent > 0 && (
                <span className="text-xs text-red-500 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {certificateInsights.urgent} urgent
                </span>
              )}
              {certificateInsights.urgent === 0 && certificateInsights.expiringSoon > 0 && (
                <span className="text-xs text-yellow-500 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {certificateInsights.expiringSoon} soon
                </span>
              )}
            </div>
          </Link>

          {/* Data Residency */}
          <Link
            to={`${baseFindingsUrl}?type=data_residency_violation&status=open`}
            className={cn(
              "p-3 rounded-lg border transition-colors hover:bg-muted/50",
              residencyViolations > 0
                ? "bg-red-500/10 border-red-500/20"
                : "bg-green-500/10 border-green-500/20"
            )}
          >
            <div className="flex items-center gap-2 mb-1">
              <MapPin className={cn(
                "h-4 w-4",
                residencyViolations > 0 ? "text-red-500" : "text-green-500"
              )} />
              <span className="text-xs text-muted-foreground">Data Residency</span>
            </div>
            <div className={cn(
              "text-lg font-semibold",
              residencyViolations > 0 ? "text-red-500" : "text-green-500"
            )}>
              {residencyViolations > 0 ? `${residencyViolations} violations` : "Compliant"}
            </div>
          </Link>

          {/* Tagging Compliance */}
          <Link
            to={`${baseFindingsUrl}?type=missing_tag&status=open`}
            className={cn(
              "p-3 rounded-lg border transition-colors hover:bg-muted/50",
              complianceDetails.missingTags > 0
                ? "bg-yellow-500/10 border-yellow-500/20"
                : "bg-green-500/10 border-green-500/20"
            )}
          >
            <div className="flex items-center gap-2 mb-1">
              <Tag className={cn(
                "h-4 w-4",
                complianceDetails.missingTags > 0 ? "text-yellow-500" : "text-green-500"
              )} />
              <span className="text-xs text-muted-foreground">Tagging</span>
            </div>
            <div className={cn(
              "text-lg font-semibold",
              complianceDetails.missingTags > 0 ? "text-yellow-500" : "text-green-500"
            )}>
              {complianceDetails.missingTags > 0 ? `${complianceDetails.missingTags} missing` : "Complete"}
            </div>
          </Link>

          {/* Security Compliance */}
          <Link
            to={`${baseFindingsUrl}?types=public_access,permissive_security_group,unencrypted_resource&status=open`}
            className={cn(
              "p-3 rounded-lg border transition-colors hover:bg-muted/50",
              complianceDetails.securityIssues > 0
                ? "bg-orange-500/10 border-orange-500/20"
                : "bg-green-500/10 border-green-500/20"
            )}
          >
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className={cn(
                "h-4 w-4",
                complianceDetails.securityIssues > 0 ? "text-orange-500" : "text-green-500"
              )} />
              <span className="text-xs text-muted-foreground">Security</span>
            </div>
            <div className={cn(
              "text-lg font-semibold",
              complianceDetails.securityIssues > 0 ? "text-orange-500" : "text-green-500"
            )}>
              {complianceDetails.securityIssues > 0 ? `${complianceDetails.securityIssues} issues` : "Secure"}
            </div>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
