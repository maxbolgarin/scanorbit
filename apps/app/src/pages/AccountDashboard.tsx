import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// New dashboard components
import { CriticalAlertBanner } from "@/components/dashboard/CriticalAlertBanner";
import { HealthScoreCard } from "@/components/dashboard/HealthScoreCard";
import { OpenIssuesCard } from "@/components/dashboard/OpenIssuesCard";
import { ScanStatusCard } from "@/components/dashboard/ScanStatusCard";
import { ResourceHealthCard } from "@/components/dashboard/ResourceHealthCard";
import { CostOptimizationCard } from "@/components/dashboard/CostOptimizationCard";
import { ComplianceStatusCard } from "@/components/dashboard/ComplianceStatusCard";
import { RecentActivityCard } from "@/components/dashboard/RecentActivityCard";

import { useEnhancedDashboardSummary } from "@/hooks/use-dashboard";
import { useAwsAccount, useTriggerScan, useScanHistory, useActiveScans, useScanCompletionRefresh } from "@/hooks/use-aws-accounts";
import { toast } from "@/hooks/use-toast";
import { ACTIVE_SCAN_STATUSES } from "@/types";
import { useQueryClient } from "@tanstack/react-query";
import {
  RefreshCw,
  Play,
  AlertTriangle,
  Scan,
  ArrowRight,
  Cloud,
  ExternalLinkIcon,
} from "lucide-react";

export default function AccountDashboard() {
  const { accountId } = useParams<{ accountId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Fetch account-specific data
  const { data: account, isLoading: accountLoading } = useAwsAccount(accountId!);
  const { data: summary, isLoading: summaryLoading, isFetching } = useEnhancedDashboardSummary({ awsAccountId: accountId });
  const { data: scanHistory, isLoading: scansLoading } = useScanHistory(accountId!);
  const { data: activeScans } = useActiveScans();
  const triggerScan = useTriggerScan();

  // Auto-refresh data when scans complete
  useScanCompletionRefresh();

  const [showScanDialog, setShowScanDialog] = useState(false);

  const handleScan = async () => {
    if (!accountId) return;

    try {
      await triggerScan.mutateAsync(accountId);
      toast({
        title: "Scan started",
        description: "Your AWS account is being scanned. This may take a few minutes.",
        type: "success",
      });
    } catch {
      toast({
        title: "Scan failed",
        description: "Failed to start scan. Please try again.",
        type: "error",
      });
    }
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["findings"] });
    queryClient.invalidateQueries({ queryKey: ["scan-history", accountId] });
  };

  const handleTriggerScan = (accId: string) => {
    if (accId === accountId) {
      handleScan();
    }
  };

  const hasCompletedScan = scanHistory?.some(scan =>
    scan.status === "complete" || scan.status === "partial"
  );

  // Filter active scans for this account
  const accountActiveScans = activeScans?.filter(scan => scan.awsAccountId === accountId);
  const hasScanInProgress = (accountActiveScans && accountActiveScans.length > 0) ||
    scanHistory?.some(scan => ACTIVE_SCAN_STATUSES.includes(scan.status));

  // Base URL for navigation
  const baseUrl = `/accounts/${accountId}`;

  if (accountLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!account) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="rounded-full bg-destructive/10 p-4">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">Account not found</h3>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            The requested AWS account could not be found or may have been deleted.
          </p>
          <Button className="mt-6" onClick={() => navigate("/overview")}>
            Go to Overview
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header with account info */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="rounded-lg bg-primary/10 p-2">
            <Cloud className="h-6 w-6 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{account.name}</h1>
              {account.status === "ok" && (
                <Badge variant="outline" className="text-green-600 border-green-600">
                  Connected
                </Badge>
              )}
              {account.status === "error" && (
                <Badge variant="destructive">Error</Badge>
              )}
              {account.status === "pending" && (
                <Badge variant="secondary">Pending</Badge>
              )}
            </div>
            <p className="text-muted-foreground font-mono text-sm">
              {account.awsAccountId}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!hasCompletedScan && account.status === "ok" && (
            <Button
              variant="default"
              size="sm"
              onClick={() => setShowScanDialog(true)}
              disabled={triggerScan.isPending || hasScanInProgress}
            >
              <Play className="mr-2 h-4 w-4" />
              Start Scan
            </Button>
          )}
          {hasCompletedScan && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowScanDialog(true)}
                disabled={triggerScan.isPending || hasScanInProgress}
              >
                <Play className="mr-2 h-4 w-4" />
                Rescan
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isFetching}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Account error state */}
      {account.status === "error" && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="flex items-start gap-4 py-4">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium text-destructive">Connection Error</h4>
              <p className="text-sm text-muted-foreground mt-1">
                {account.lastError || "Unable to connect to this AWS account. Please check your IAM role configuration."}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => navigate("/accounts")}
              >
                <ExternalLinkIcon className="mr-2 h-4 w-4" />
                Manage Account
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scanning in progress state */}
      {account.status === "ok" && !hasCompletedScan && hasScanInProgress && (
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-primary/20 p-5">
              <RefreshCw className="h-10 w-10 text-primary animate-spin" />
            </div>
            <h3 className="mt-6 text-xl font-semibold">Scanning your infrastructure...</h3>
            <p className="mt-3 max-w-lg text-muted-foreground">
              This account is being scanned. This may take a few minutes depending on
              the size of your infrastructure. The dashboard will update once the scan completes.
            </p>
            <Button
              variant="outline"
              size="lg"
              className="mt-8"
              onClick={() => navigate(`${baseUrl}/scans`)}
            >
              View Scan Progress
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Invitation to start first scan */}
      {account.status === "ok" && !hasCompletedScan && !hasScanInProgress && (
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-primary/20 p-5">
              <Scan className="h-10 w-10 text-primary" />
            </div>
            <h3 className="mt-6 text-xl font-semibold">Ready to scan this account</h3>
            <p className="mt-3 max-w-lg text-muted-foreground">
              Run a scan to discover resources, identify security vulnerabilities,
              find cost optimization opportunities, and check compliance status for this account.
            </p>
            <Button
              size="lg"
              className="mt-8"
              onClick={() => setShowScanDialog(true)}
              disabled={triggerScan.isPending || hasScanInProgress}
            >
              <Play className="mr-2 h-5 w-5" />
              Start Scan
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Dashboard content - only show after first scan is completed AND data is available */}
      {hasCompletedScan && summary && (
        <>
          {/* TIER 1: Critical Alert Banner */}
          <CriticalAlertBanner summary={summary} accountId={accountId} />

          {/* TIER 1: Status Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <HealthScoreCard
              summary={summary}
              isLoading={summaryLoading}
            />
            <OpenIssuesCard
              summary={summary}
              isLoading={summaryLoading}
              accountId={accountId}
            />
            <ScanStatusCard
              accounts={account ? [account] : []}
              activeScans={accountActiveScans}
              recentScans={scanHistory}
              onTriggerScan={handleTriggerScan}
              isTriggeringScan={triggerScan.isPending}
              isLoading={scansLoading}
              accountId={accountId}
            />
          </div>

          {/* TIER 2: Resource & Compliance */}
          <div className="grid gap-4 md:grid-cols-2">
            <ResourceHealthCard
              summary={summary}
              isLoading={summaryLoading}
              accountId={accountId}
            />
            <ComplianceStatusCard
              summary={summary}
              isLoading={summaryLoading}
              accountId={accountId}
            />
          </div>

          {/* TIER 3: Cost & Activity */}
          <div className="grid gap-4 md:grid-cols-2">
            <CostOptimizationCard
              summary={summary}
              isLoading={summaryLoading}
              accountId={accountId}
            />
            <RecentActivityCard
              scans={scanHistory}
              accounts={account ? [account] : []}
              isLoading={scansLoading}
              accountId={accountId}
            />
          </div>
        </>
      )}

      {/* Fallback: Scan exists but data is unavailable or loading */}
      {hasCompletedScan && !summary && !summaryLoading && (
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-primary/20 p-5">
              <Scan className="h-10 w-10 text-primary" />
            </div>
            <h3 className="mt-6 text-xl font-semibold">Dashboard data unavailable</h3>
            <p className="mt-3 max-w-lg text-muted-foreground">
              We couldn't load the dashboard summary. This may happen if your scan data is incomplete
              or if there was an issue processing the results. Try running a new scan.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button
                size="lg"
                onClick={() => setShowScanDialog(true)}
                disabled={triggerScan.isPending || hasScanInProgress}
              >
                <Play className="mr-2 h-5 w-5" />
                Run New Scan
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={handleRefresh}
                disabled={isFetching}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
                Retry Loading
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scan confirmation dialog */}
      <Dialog open={showScanDialog} onOpenChange={setShowScanDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start Scan</DialogTitle>
            <DialogDescription>
              This will start a scan for <span className="font-medium">{account.name}</span>.
              Scanning may take several minutes depending on the size of your infrastructure.
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
              onClick={() => {
                setShowScanDialog(false);
                handleScan();
              }}
              disabled={triggerScan.isPending}
            >
              <Play className="mr-2 h-4 w-4" />
              Start Scan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
