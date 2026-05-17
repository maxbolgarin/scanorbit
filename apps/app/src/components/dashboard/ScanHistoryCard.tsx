import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, formatDuration } from "@/lib/utils";
import {
  CheckCircle2,
  Clock,
  XCircle,
  PlayCircle,
  History,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  Loader2,
  Search,
  Ban,
} from "lucide-react";
import type { Scan, AwsAccount, ScanStatus } from "@/types";

interface ScanHistoryCardProps {
  scans: Scan[];
  accounts: AwsAccount[];
  baseUrl?: string;
}

const statusConfig: Record<
  ScanStatus,
  { icon: React.ReactNode; label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  queued: {
    icon: <Clock className="h-4 w-4" />,
    label: "Queued",
    variant: "secondary",
  },
  processing: {
    icon: <Loader2 className="h-4 w-4 animate-spin" />,
    label: "Processing",
    variant: "secondary",
  },
  running: {
    icon: <PlayCircle className="h-4 w-4 animate-pulse" />,
    label: "Running",
    variant: "default",
  },
  analyzing: {
    icon: <Search className="h-4 w-4 animate-pulse" />,
    label: "Analyzing",
    variant: "default",
  },
  complete: {
    icon: <CheckCircle2 className="h-4 w-4" />,
    label: "Completed",
    variant: "outline",
  },
  partial: {
    icon: <AlertTriangle className="h-4 w-4" />,
    label: "Partial",
    variant: "outline",
  },
  error: {
    icon: <XCircle className="h-4 w-4" />,
    label: "Failed",
    variant: "destructive",
  },
  canceled: {
    icon: <Ban className="h-4 w-4" />,
    label: "Canceled",
    variant: "secondary",
  },
};

export function ScanHistoryCard({ scans, accounts, baseUrl: _baseUrl }: ScanHistoryCardProps) {
  const getAccountName = (awsAccountId: string | null) => {
    if (!awsAccountId) return "Deleted Account";
    const account = accounts.find((a) => a.id === awsAccountId);
    return account?.name || "Unknown Account";
  };

  const getDuration = (scan: Scan) => {
    if (!scan.startedAt) return null;
    const start = new Date(scan.startedAt).getTime();
    const end = scan.completedAt
      ? new Date(scan.completedAt).getTime()
      : Date.now();
    return formatDuration(end - start);
  };

  if (scans.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <History className="h-5 w-5 text-muted-foreground" />
            Scan History
          </CardTitle>
          <CardDescription>Recent infrastructure scans</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center text-muted-foreground">
            No scans yet. Connect an AWS account and run your first scan.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <History className="h-5 w-5 text-muted-foreground" />
          Scan History
        </CardTitle>
        <CardDescription>Recent infrastructure scans</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {scans.map((scan) => {
            const config = statusConfig[scan.status] || {
              icon: <Clock className="h-4 w-4" />,
              label: scan.status || "Unknown",
              variant: "secondary" as const,
            };
            const duration = getDuration(scan);

            return (
              <div
                key={scan.id}
                className="flex items-start justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className={
                    scan.status === "error" ? "text-destructive" :
                    scan.status === "complete" ? "text-status-success" :
                    scan.status === "partial" ? "text-status-high" :
                    scan.status === "running" || scan.status === "analyzing" ? "text-primary-foreground" :
                    scan.status === "canceled" ? "text-muted-foreground" :
                    "text-status-warning"
                  }>
                    {config.icon}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">
                        {getAccountName(scan.awsAccountId)}
                      </span>
                      <Badge variant={config.variant} className="text-xs">
                        {config.label}
                      </Badge>
                      {(scan.status === "complete" || scan.status === "partial") && (
                        <>
                          {scan.resourcesDiscovered > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              {scan.resourcesDiscovered} resources
                            </Badge>
                          )}
                          {scan.resourcesDelta !== 0 && (
                            <Badge
                              variant="outline"
                              className={`text-xs ${scan.resourcesDelta > 0 ? "text-status-success border-status-success" : "text-status-high border-status-high"}`}
                            >
                              {scan.resourcesDelta > 0 ? (
                                <TrendingUp className="h-3 w-3 mr-1" />
                              ) : (
                                <TrendingDown className="h-3 w-3 mr-1" />
                              )}
                              {scan.resourcesDelta > 0 ? "+" : ""}{scan.resourcesDelta}
                            </Badge>
                          )}
                          {scan.findingsNew > 0 && (
                            <Badge variant="outline" className="text-xs text-status-warning border-status-warning">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              {scan.findingsNew} new
                            </Badge>
                          )}
                          {scan.findingsResolved > 0 && (
                            <Badge variant="outline" className="text-xs text-status-success border-status-success">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              {scan.findingsResolved} resolved
                            </Badge>
                          )}
                        </>
                      )}
                      {!scan.hasKey && (
                        <Badge variant="outline" className="text-xs text-muted-foreground">
                          archived
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      {scan.startedAt && (
                        <span>Started: {formatDateTime(scan.startedAt)}</span>
                      )}
                      {duration && (
                        <span>Duration: {duration}</span>
                      )}
                    </div>
                    {scan.errorMessage && (
                      <div className="flex items-start gap-1.5 mt-1 text-xs text-destructive">
                        <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                        <span className="break-words">{scan.errorMessage}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
