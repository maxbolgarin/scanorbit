import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, CheckCircle2, AlertTriangle, RefreshCw, Server, XCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import type { Scan, AwsAccount } from "@/types";

interface RecentActivityCardProps {
  scans: Scan[] | undefined;
  accounts: AwsAccount[];
  isLoading?: boolean;
  accountId?: string;
}

interface ActivityItem {
  id: string;
  type: "scan_complete" | "scan_started" | "scan_error" | "findings_new" | "findings_resolved" | "resources_discovered";
  icon: typeof CheckCircle2;
  iconColor: string;
  title: string;
  description: string;
  timestamp: Date;
  link?: string;
}

export function RecentActivityCard({ scans, accounts, isLoading, accountId }: RecentActivityCardProps) {
  if (isLoading || !scans) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-foreground">
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-muted" />
                <div className="flex-1 space-y-1">
                  <div className="h-4 w-3/4 bg-muted rounded" />
                  <div className="h-3 w-1/4 bg-muted rounded" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const baseScansUrl = accountId ? `/accounts/${accountId}/scans` : "/overview/scans";
  const baseFindingsUrl = accountId ? `/accounts/${accountId}/findings` : "/overview/findings";

  // Build activity items from scans
  const activities: ActivityItem[] = [];

  scans.slice(0, 10).forEach((scan) => {
    const account = accounts.find(a => a.id === scan.awsAccountId);
    const accountName = account?.name || "Unknown account";

    if (scan.status === "complete" || scan.status === "partial") {
      // Scan completed
      activities.push({
        id: `${scan.id}-complete`,
        type: "scan_complete",
        icon: CheckCircle2,
        iconColor: "text-status-success",
        title: `Scan completed for ${accountName}`,
        description: `${scan.resourcesDiscovered} resources discovered`,
        timestamp: new Date(scan.completedAt || scan.createdAt),
        link: baseScansUrl,
      });

      // New findings if any
      if (scan.findingsNew > 0) {
        activities.push({
          id: `${scan.id}-findings-new`,
          type: "findings_new",
          icon: AlertTriangle,
          iconColor: "text-status-high",
          title: `${scan.findingsNew} new finding${scan.findingsNew > 1 ? "s" : ""} detected`,
          description: `In ${accountName}`,
          timestamp: new Date(scan.completedAt || scan.createdAt),
          link: `${baseFindingsUrl}?status=open`,
        });
      }

      // Resolved findings if any
      if (scan.findingsResolved > 0) {
        activities.push({
          id: `${scan.id}-findings-resolved`,
          type: "findings_resolved",
          icon: CheckCircle2,
          iconColor: "text-status-info",
          title: `${scan.findingsResolved} finding${scan.findingsResolved > 1 ? "s" : ""} resolved`,
          description: `In ${accountName}`,
          timestamp: new Date(scan.completedAt || scan.createdAt),
          link: `${baseFindingsUrl}?status=resolved`,
        });
      }

      // Resource changes if significant
      if (Math.abs(scan.resourcesDelta) > 0) {
        const isIncrease = scan.resourcesDelta > 0;
        activities.push({
          id: `${scan.id}-resources`,
          type: "resources_discovered",
          icon: Server,
          iconColor: isIncrease ? "text-status-success" : "text-status-warning",
          title: `${isIncrease ? "+" : ""}${scan.resourcesDelta} resource${Math.abs(scan.resourcesDelta) > 1 ? "s" : ""}`,
          description: isIncrease ? `New resources in ${accountName}` : `Resources removed from ${accountName}`,
          timestamp: new Date(scan.completedAt || scan.createdAt),
        });
      }
    } else if (scan.status === "error") {
      activities.push({
        id: `${scan.id}-error`,
        type: "scan_error",
        icon: XCircle,
        iconColor: "text-status-critical",
        title: `Scan failed for ${accountName}`,
        description: scan.errorMessage || "Unknown error",
        timestamp: new Date(scan.createdAt),
        link: baseScansUrl,
      });
    } else if (["queued", "processing", "running", "analyzing"].includes(scan.status)) {
      activities.push({
        id: `${scan.id}-started`,
        type: "scan_started",
        icon: RefreshCw,
        iconColor: "text-status-info",
        title: `Scan ${scan.status} for ${accountName}`,
        description: "In progress...",
        timestamp: new Date(scan.startedAt || scan.createdAt),
        link: baseScansUrl,
      });
    }
  });

  // Sort by timestamp and take top 8
  const sortedActivities = activities
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, 8);

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {sortedActivities.length > 0 ? (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border" />

            <div className="space-y-3">
              {sortedActivities.map((activity) => {
                const Icon = activity.icon;
                const content = (
                  <div className="flex items-start gap-3 relative">
                    {/* Icon */}
                    <div className={cn(
                      "h-6 w-6 rounded-full bg-background border flex items-center justify-center flex-shrink-0 z-10",
                      activity.iconColor
                    )}>
                      <Icon className="h-3 w-3" />
                    </div>

                    <div className="flex-1 min-w-0 pt-0.5">
                      {/* Title */}
                      <p className="text-sm font-medium truncate">
                        {activity.title}
                      </p>

                      {/* Description and time */}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <span className="truncate">{activity.description}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1 flex-shrink-0">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(activity.timestamp, { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </div>
                );

                return activity.link ? (
                  <Link
                    key={activity.id}
                    to={activity.link}
                    className="block hover:bg-muted/50 rounded-lg p-1 -m-1 transition-colors"
                  >
                    {content}
                  </Link>
                ) : (
                  <div key={activity.id} className="p-1 -m-1">
                    {content}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-sm text-muted-foreground">
            <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No recent activity.</p>
            <p className="text-xs mt-1">Run a scan to see activity here.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
