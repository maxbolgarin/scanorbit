import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Clock, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import type { Scan, AwsAccount } from "@/types";

interface ScanStatusCardProps {
  accounts: AwsAccount[];
  activeScans: Scan[] | undefined;
  recentScans: Scan[] | undefined;
  onTriggerScan: (accountId: string) => void;
  isTriggeringScan: boolean;
  isLoading?: boolean;
}

export function ScanStatusCard({
  accounts,
  activeScans,
  recentScans,
  onTriggerScan,
  isTriggeringScan,
  isLoading,
}: ScanStatusCardProps) {
  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Scan Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-muted" />
              <div className="space-y-2">
                <div className="h-6 w-24 bg-muted rounded" />
                <div className="h-4 w-32 bg-muted rounded" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasActiveScans = activeScans && activeScans.length > 0;

  // Get the most recent scan
  const lastScan = recentScans?.[0];
  const lastScanTime = lastScan?.completedAt || lastScan?.startedAt;

  // Calculate status
  const statusConfig = hasActiveScans
    ? {
        label: "Scanning",
        description: `${activeScans.length} scan${activeScans.length > 1 ? "s" : ""} in progress`,
        bgColor: "bg-blue-500/10",
        borderColor: "border-blue-500/30",
        iconColor: "text-blue-500",
        icon: Loader2,
        animate: true,
      }
    : lastScan?.status === "error"
    ? {
        label: "Error",
        description: lastScan.errorMessage || "Last scan failed",
        bgColor: "bg-red-500/10",
        borderColor: "border-red-500/30",
        iconColor: "text-red-500",
        icon: AlertCircle,
        animate: false,
      }
    : {
        label: "Ready",
        description: lastScanTime
          ? `Last scan ${formatDistanceToNow(new Date(lastScanTime), { addSuffix: true })}`
          : "No scans yet",
        bgColor: "bg-green-500/10",
        borderColor: "border-green-500/30",
        iconColor: "text-green-500",
        icon: CheckCircle2,
        animate: false,
      };

  const StatusIcon = statusConfig.icon;

  // Get accounts that can be scanned (have OK status)
  const scannableAccounts = accounts.filter(a => a.status === "ok");
  const canScan = scannableAccounts.length > 0 && !hasActiveScans && !isTriggeringScan;

  const handleScanAll = () => {
    // Trigger scan for each account
    scannableAccounts.forEach(account => {
      onTriggerScan(account.id);
    });
  };

  return (
    <Card className={cn("h-full transition-colors", statusConfig.borderColor, "border")}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <RefreshCw className="h-4 w-4" />
          Scan Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-4">
          {/* Icon */}
          <div className={cn("relative h-12 w-12 rounded-full flex items-center justify-center", statusConfig.bgColor)}>
            <StatusIcon className={cn("h-5 w-5", statusConfig.iconColor, statusConfig.animate && "animate-spin")} />
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold">
                {statusConfig.label}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {statusConfig.description}
            </p>
          </div>
        </div>

        {/* Scan Button */}
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={handleScanAll}
          disabled={!canScan}
        >
          {isTriggeringScan ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Starting...
            </>
          ) : hasActiveScans ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Scanning...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Scan All Accounts
            </>
          )}
        </Button>

        {/* Account scan status if scanning */}
        {hasActiveScans && (
          <div className="text-xs text-muted-foreground space-y-1">
            {activeScans.slice(0, 3).map(scan => {
              const account = accounts.find(a => a.id === scan.awsAccountId);
              return (
                <div key={scan.id} className="flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                  <span className="truncate">{account?.name || "Unknown"}: {scan.status}</span>
                </div>
              );
            })}
            {activeScans.length > 3 && (
              <span className="text-muted-foreground">+{activeScans.length - 3} more...</span>
            )}
          </div>
        )}

        {/* Last scan details */}
        {!hasActiveScans && lastScan && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>
              {lastScan.resourcesDiscovered} resources discovered
              {lastScan.findingsNew > 0 && `, ${lastScan.findingsNew} new findings`}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
