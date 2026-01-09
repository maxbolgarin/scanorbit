import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SeverityBadge } from "@/components/shared/SeverityBadge";
import { formatCurrency } from "@/lib/utils";
import type { Finding } from "@/types";
import {
  ArrowRight,
  Zap,
  DollarSign,
  Shield,
  Clock,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";

interface QuickActionsPanelProps {
  findings: Finding[];
  isLoading?: boolean;
}

// Map finding types to actionable descriptions
const findingActions: Record<string, { title: string; action: string }> = {
  orphaned_volume: { title: "Orphaned EBS Volume", action: "Delete to save costs" },
  orphaned_eip: { title: "Unused Elastic IP", action: "Release to stop charges" },
  orphaned_snapshot: { title: "Orphaned Snapshot", action: "Delete unused snapshot" },
  ssl_expiry: { title: "SSL Certificate Expiring", action: "Renew before expiration" },
  data_residency_violation: { title: "Data Residency Issue", action: "Move to compliant region" },
  unencrypted_resource: { title: "Unencrypted Resource", action: "Enable encryption" },
  public_access: { title: "Public Access Detected", action: "Review access settings" },
  permissive_security_group: { title: "Permissive Security Group", action: "Restrict inbound rules" },
  open_all_ports: { title: "All Ports Open", action: "Close unnecessary ports" },
  unused_resource: { title: "Unused Resource", action: "Consider terminating" },
  stopped_instance: { title: "Stopped Instance", action: "Terminate or restart" },
  unused_log_group: { title: "Unused Log Group", action: "Delete or set retention" },
  missing_tag: { title: "Missing Tag", action: "Add required tags" },
  old_access_key: { title: "Old Access Key", action: "Rotate access key" },
  unused_access_key: { title: "Unused Access Key", action: "Delete unused key" },
  unused_iam_role: { title: "Unused IAM Role", action: "Delete unused role" },
  user_without_mfa: { title: "User Without MFA", action: "Enable MFA" },
};

// Get category icon for finding type
const getCategoryIcon = (type: string) => {
  const costTypes = ["orphaned_volume", "orphaned_eip", "orphaned_snapshot", "unused_resource", "stopped_instance", "unused_log_group"];
  const securityTypes = ["unencrypted_resource", "public_access", "permissive_security_group", "open_all_ports", "old_access_key", "unused_access_key", "unused_iam_role", "user_without_mfa"];

  if (costTypes.includes(type)) return DollarSign;
  if (securityTypes.includes(type)) return Shield;
  return Clock;
};

export function QuickActionsPanel({ findings, isLoading }: QuickActionsPanelProps) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardHeader>
          <div className="h-5 w-40 rounded bg-muted" />
          <div className="h-4 w-60 rounded bg-muted" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 rounded-lg bg-muted" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Group by severity and calculate total potential savings
  const highPriority = findings.filter(f => f.severity === "high").slice(0, 2);
  const mediumPriority = findings.filter(f => f.severity === "medium").slice(0, 2);
  const topActions = [...highPriority, ...mediumPriority].slice(0, 4);

  const totalSavings = findings.reduce((sum, f) => {
    const savings = typeof f.details?.estimatedSavings === "number" ? f.details.estimatedSavings : 0;
    return sum + savings;
  }, 0);

  if (findings.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            Quick Actions
          </CardTitle>
          <CardDescription>Recommended actions for your infrastructure</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="rounded-full bg-green-500/10 p-4">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
            <p className="mt-4 text-lg font-medium">All caught up!</p>
            <p className="text-sm text-muted-foreground">
              No recommended actions at this time.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              Quick Actions
            </CardTitle>
            <CardDescription>High-impact actions for your infrastructure</CardDescription>
          </div>
          {totalSavings > 0 && (
            <Badge variant="secondary" className="gap-1 text-green-600">
              <DollarSign className="h-3 w-3" />
              {formatCurrency(totalSavings)} potential savings
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {topActions.map((finding) => {
          const actionInfo = findingActions[finding.type] || {
            title: finding.type,
            action: "Review and take action"
          };
          const CategoryIcon = getCategoryIcon(finding.type);
          const savings = typeof finding.details?.estimatedSavings === "number" ? finding.details.estimatedSavings : 0;

          return (
            <div
              key={finding.id}
              className="group cursor-pointer rounded-lg border p-3 transition-all hover:border-primary/50 hover:bg-muted/50"
              onClick={() => navigate(`/findings?id=${finding.id}`)}
            >
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-muted p-2">
                  <CategoryIcon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <SeverityBadge severity={finding.severity} />
                    <span className="font-medium text-sm truncate">
                      {actionInfo.title}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {finding.summary}
                  </p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs text-primary">
                      {actionInfo.action}
                    </span>
                    {savings > 0 && (
                      <span className="text-xs text-green-600 font-medium">
                        Save {formatCurrency(savings)}/mo
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
            </div>
          );
        })}

        {/* View all button */}
        {findings.length > 4 && (
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => navigate("/findings")}
          >
            View all {findings.length} actions
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
