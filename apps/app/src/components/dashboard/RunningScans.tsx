import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatRelativeTime } from "@/lib/utils";
import { Radar, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import type { Scan, AwsAccount } from "@/types";

interface RunningScansProps {
  scans: Scan[];
  accounts: AwsAccount[];
}

export function RunningScans({ scans, accounts }: RunningScansProps) {
  if (scans.length === 0) {
    return null;
  }

  const getAccountName = (awsAccountId: string) => {
    const account = accounts.find((a) => a.id === awsAccountId);
    return account?.name || "Unknown Account";
  };

  const getStatusIcon = (status: Scan["status"]) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case "running":
        return <Radar className="h-4 w-4 animate-pulse text-primary" />;
      case "complete":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusText = (status: Scan["status"]) => {
    switch (status) {
      case "pending":
        return "Initializing...";
      case "running":
        return "Scanning resources...";
      case "complete":
        return "Complete";
      case "error":
        return "Failed";
    }
  };

  // Estimate progress based on time (assume ~5 min scan)
  const getProgress = (scan: Scan) => {
    if (scan.status === "complete") return 100;
    if (scan.status === "error") return 0;
    if (scan.status === "pending") return 5;

    if (!scan.startedAt) return 10;

    const started = new Date(scan.startedAt).getTime();
    const now = Date.now();
    const elapsed = now - started;
    const estimatedDuration = 5 * 60 * 1000; // 5 minutes
    const progress = Math.min(95, Math.round((elapsed / estimatedDuration) * 100));
    return Math.max(10, progress);
  };

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Radar className="h-5 w-5 animate-pulse text-primary" />
          Active Scans
        </CardTitle>
        <CardDescription>
          Scanning your AWS infrastructure
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {scans.map((scan) => (
          <div
            key={scan.id}
            className="rounded-lg border bg-background p-3 space-y-2"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getStatusIcon(scan.status)}
                <span className="font-medium">{getAccountName(scan.awsAccountId)}</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {scan.startedAt ? formatRelativeTime(scan.startedAt) : "Just started"}
              </span>
            </div>
            <Progress value={getProgress(scan)} className="h-2" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{getStatusText(scan.status)}</span>
              {scan.resourcesDiscovered > 0 && (
                <span>{scan.resourcesDiscovered} resources found</span>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
