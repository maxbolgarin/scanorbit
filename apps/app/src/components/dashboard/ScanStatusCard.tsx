import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RefreshCw, Clock, CheckCircle2, AlertCircle, Loader2, Play, ArrowRight } from "lucide-react";
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
  accountId?: string;
}

export function ScanStatusCard({
  accounts,
  activeScans,
  recentScans,
  onTriggerScan,
  isTriggeringScan,
  isLoading,
  accountId,
}: ScanStatusCardProps) {
  const [showScanDialog, setShowScanDialog] = useState(false);
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-foreground">
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
        bgColor: "bg-muted",
        borderColor: "border-status-info/40",
        iconColor: "text-status-info",
        icon: Loader2,
        animate: true,
      }
    : lastScan?.status === "error"
    ? {
        label: "Error",
        description: lastScan.errorMessage || "Last scan failed",
        bgColor: "bg-muted",
        borderColor: "border-status-critical/40",
        iconColor: "text-status-critical",
        icon: AlertCircle,
        animate: false,
      }
    : {
        label: "Ready",
        description: lastScanTime
          ? `Last scan ${formatDistanceToNow(new Date(lastScanTime), { addSuffix: true })}`
          : "No scans yet",
        bgColor: "bg-muted",
        borderColor: "border-status-success/40",
        iconColor: "text-status-success",
        icon: CheckCircle2,
        animate: false,
      };

  const StatusIcon = statusConfig.icon;

  // Get accounts that can be scanned (have OK status)
  const scannableAccounts = accounts.filter(a => a.status === "ok");
  const canScan = scannableAccounts.length > 0 && !hasActiveScans && !isTriggeringScan;
  const isSingleAccount = accounts.length === 1;

  const handleScanAll = () => {
    // Trigger scan for each account
    scannableAccounts.forEach(account => {
      onTriggerScan(account.id);
    });
    setShowScanDialog(false);
  };

  return (
    <Card className={cn("h-full transition-colors", statusConfig.borderColor, "border")}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
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
          onClick={() => setShowScanDialog(true)}
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
              Scan
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
                  <Loader2 className="h-3 w-3 animate-spin text-status-info" />
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

        {/* View all scans link */}
        <Button
          variant="link"
          size="sm"
          className="w-full text-xs h-auto py-1"
          onClick={() => navigate(accountId ? `/accounts/${accountId}/scans` : "/overview/scans")}
        >
          View Scan History
          <ArrowRight className="h-3 w-3 ml-1" />
        </Button>
      </CardContent>

      {/* Scan confirmation dialog */}
      <Dialog open={showScanDialog} onOpenChange={setShowScanDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isSingleAccount ? "Start Scan" : "Scan All Accounts"}</DialogTitle>
            <DialogDescription>
              {isSingleAccount ? (
                <>This will start a scan for <span className="font-medium">{accounts[0]?.name}</span>.</>
              ) : (
                <>This will start a scan for all {scannableAccounts.length} connected AWS account{scannableAccounts.length !== 1 ? "s" : ""}.</>
              )}
              {" "}Scanning may take several minutes depending on the size of your infrastructure.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowScanDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleScanAll}
              disabled={isTriggeringScan}
            >
              <Play className="mr-2 h-4 w-4" />
              Start Scan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
