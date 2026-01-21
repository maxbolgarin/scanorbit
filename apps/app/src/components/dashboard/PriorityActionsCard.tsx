import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ListTodo, ExternalLink, ChevronRight, AlertCircle, AlertTriangle, Clock, DollarSign, Shield, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import type { Finding, EnhancedDashboardSummary } from "@/types";

interface PriorityActionsCardProps {
  findings: Finding[] | undefined;
  summary: EnhancedDashboardSummary | undefined;
  isLoading?: boolean;
  accountId?: string;
}

// Map finding types to categories for display
const findingCategoryConfig: Record<string, { label: string; icon: typeof Shield; color: string }> = {
  // Security
  public_access: { label: "Security", icon: Shield, color: "text-red-500" },
  permissive_security_group: { label: "Security", icon: Shield, color: "text-red-500" },
  open_all_ports: { label: "Security", icon: Shield, color: "text-red-500" },
  publicly_accessible_rds: { label: "Security", icon: Shield, color: "text-red-500" },
  public_snapshot: { label: "Security", icon: Shield, color: "text-red-500" },
  unencrypted_resource: { label: "Security", icon: Shield, color: "text-orange-500" },
  insecure_tls: { label: "Security", icon: Shield, color: "text-orange-500" },

  // SSL/Certificates
  ssl_expiry: { label: "Certificate", icon: Clock, color: "text-yellow-500" },

  // Cost
  orphaned_volume: { label: "Cost", icon: DollarSign, color: "text-green-500" },
  orphaned_eip: { label: "Cost", icon: DollarSign, color: "text-green-500" },
  orphaned_snapshot: { label: "Cost", icon: DollarSign, color: "text-green-500" },
  orphaned_eni: { label: "Cost", icon: DollarSign, color: "text-green-500" },
  idle_load_balancer: { label: "Cost", icon: DollarSign, color: "text-green-500" },
  idle_nat_gateway: { label: "Cost", icon: DollarSign, color: "text-green-500" },
  unused_security_group: { label: "Cost", icon: DollarSign, color: "text-green-500" },
  stopped_instance: { label: "Cost", icon: DollarSign, color: "text-green-500" },
  unused_resource: { label: "Cost", icon: DollarSign, color: "text-green-500" },
  unused_log_group: { label: "Cost", icon: DollarSign, color: "text-green-500" },

  // Compliance
  data_residency_violation: { label: "Compliance", icon: AlertCircle, color: "text-red-500" },
  missing_tag: { label: "Tagging", icon: Tag, color: "text-yellow-500" },
  cloudtrail_disabled: { label: "Compliance", icon: AlertCircle, color: "text-orange-500" },
  vpc_flow_logs_disabled: { label: "Compliance", icon: AlertCircle, color: "text-orange-500" },
  backup_not_configured: { label: "Compliance", icon: AlertCircle, color: "text-orange-500" },

  // IAM
  old_access_key: { label: "IAM", icon: Shield, color: "text-orange-500" },
  unused_access_key: { label: "IAM", icon: Shield, color: "text-yellow-500" },
  unused_iam_role: { label: "IAM", icon: Shield, color: "text-yellow-500" },
  user_without_mfa: { label: "IAM", icon: Shield, color: "text-orange-500" },
  root_account_usage: { label: "IAM", icon: Shield, color: "text-red-500" },
  overly_permissive_policy: { label: "IAM", icon: Shield, color: "text-orange-500" },
  cross_account_trust: { label: "IAM", icon: Shield, color: "text-yellow-500" },
};

const severityConfig = {
  critical: { color: "bg-red-500", textColor: "text-red-500", priority: 0 },
  high: { color: "bg-orange-500", textColor: "text-orange-500", priority: 1 },
  medium: { color: "bg-yellow-500", textColor: "text-yellow-500", priority: 2 },
  low: { color: "bg-blue-500", textColor: "text-blue-500", priority: 3 },
  trivial: { color: "bg-slate-400", textColor: "text-slate-400", priority: 4 },
};

export function PriorityActionsCard({ findings, summary, isLoading, accountId }: PriorityActionsCardProps) {
  if (isLoading || !findings) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Priority Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-muted" />
                <div className="flex-1 space-y-1">
                  <div className="h-4 w-3/4 bg-muted rounded" />
                  <div className="h-3 w-1/2 bg-muted rounded" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const baseFindingsUrl = accountId ? `/accounts/${accountId}/findings` : "/overview/findings";
  const baseResourcesUrl = accountId ? `/accounts/${accountId}/resources` : "/overview/resources";

  // Sort findings by priority: severity, then urgency (SSL expiry), then cost impact
  const sortedFindings = [...findings].sort((a, b) => {
    // First by severity
    const severityDiff = severityConfig[a.severity].priority - severityConfig[b.severity].priority;
    if (severityDiff !== 0) return severityDiff;

    // Then by type priority (SSL expiry first, cost savings second)
    const typeOrder: Record<string, number> = {
      ssl_expiry: 0,
      data_residency_violation: 1,
      public_access: 2,
      orphaned_volume: 3,
      orphaned_eip: 3,
    };
    const aOrder = typeOrder[a.type] ?? 10;
    const bOrder = typeOrder[b.type] ?? 10;
    return aOrder - bOrder;
  }).slice(0, 5);

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListTodo className="h-4 w-4" />
            Priority Actions
          </div>
          <Link
            to={`${baseFindingsUrl}?status=open`}
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            View all findings
            <ExternalLink className="h-3 w-3" />
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {sortedFindings.length > 0 ? (
          <div className="space-y-1">
            {sortedFindings.map((finding) => {
              const category = findingCategoryConfig[finding.type] || {
                label: "Issue",
                icon: AlertTriangle,
                color: "text-muted-foreground",
              };
              const CategoryIcon = category.icon;
              const severity = severityConfig[finding.severity];

              // Get cost estimate if available
              const costEstimate = finding.details?.costEstimate as number | undefined;

              // Build link to resource or finding
              const findingLink = finding.resourceId
                ? `${baseResourcesUrl}/${finding.resourceId}`
                : `${baseFindingsUrl}?type=${finding.type}&status=open`;

              return (
                <Link
                  key={finding.id}
                  to={findingLink}
                  className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors group"
                >
                  {/* Severity indicator */}
                  <div className={cn("h-2 w-2 rounded-full mt-1.5 flex-shrink-0", severity.color)} />

                  <div className="flex-1 min-w-0">
                    {/* Summary */}
                    <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                      {finding.summary}
                    </p>

                    {/* Meta info */}
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                      <span className={cn("flex items-center gap-1", category.color)}>
                        <CategoryIcon className="h-3 w-3" />
                        {category.label}
                      </span>
                      <span>•</span>
                      <span className={severity.textColor}>
                        {finding.severity.charAt(0).toUpperCase() + finding.severity.slice(1)}
                      </span>
                      {costEstimate && (
                        <>
                          <span>•</span>
                          <span className="text-green-500">${costEstimate}/mo</span>
                        </>
                      )}
                      <span>•</span>
                      <span>{formatDistanceToNow(new Date(finding.createdAt), { addSuffix: true })}</span>
                    </div>
                  </div>

                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 mt-1" />
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-sm text-muted-foreground">
            <ListTodo className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No priority actions needed.</p>
            <p className="text-xs mt-1">All findings have been addressed!</p>
          </div>
        )}

        {/* Show more if there are more findings */}
        {summary && summary.findingCounts.total > 5 && (
          <div className="mt-3 pt-3 border-t">
            <Button variant="ghost" size="sm" asChild className="w-full">
              <Link to={`${baseFindingsUrl}?status=open`}>
                View all {summary.findingCounts.total} findings
                <ChevronRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
