import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { useAwsAccounts, useTriggerScan, useRecentScans, useActiveScans, useScanCompletionRefresh } from "@/hooks/use-aws-accounts";
import { useRecentActionedFindings } from "@/hooks/use-findings";
import { toast } from "@/hooks/use-toast";
import { ACTIVE_SCAN_STATUSES } from "@/types";
import { useQueryClient } from "@tanstack/react-query";
import {
  RefreshCw,
  Play,
  Server,
  Settings,
  Scan,
  ArrowRight,
  Building2,
} from "lucide-react";

export default function Overview() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Data hooks
  const { data: summary, isLoading: summaryLoading, isFetching, error: summaryError } = useEnhancedDashboardSummary();

  // Debug: log summary error
  if (summaryError) {
    console.error("Dashboard summary error:", summaryError);
  }
  const { accounts, isLoading: accountsLoading } = useAwsAccounts();
  const { data: recentScans, isLoading: scansLoading } = useRecentScans(10);
  const { data: activeScans } = useActiveScans();
  const { data: actionedFindings } = useRecentActionedFindings();
  const triggerScan = useTriggerScan();

  // Auto-refresh data when scans complete
  useScanCompletionRefresh();

  const [showScanAllDialog, setShowScanAllDialog] = useState(false);

  const handleRescan = async (accountId: string) => {
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

  const handleScanAll = async () => {
    if (!accounts || accounts.length === 0) return;

    const scannableAccounts = accounts.filter(a => a.status === "ok");
    if (scannableAccounts.length === 0) {
      toast({
        title: "No accounts ready",
        description: "No accounts are in a ready state to be scanned.",
        type: "warning",
      });
      return;
    }

    const results = await Promise.allSettled(
      scannableAccounts.map(account => triggerScan.mutateAsync(account.id))
    );

    const succeeded = results.filter(r => r.status === "fulfilled").length;
    const failed = results.filter(r => r.status === "rejected").length;

    if (failed === 0) {
      toast({
        title: "Scans started",
        description: `Started scanning ${succeeded} AWS account(s).`,
        type: "success",
      });
    } else if (succeeded === 0) {
      toast({
        title: "Scans failed",
        description: `Failed to start scans for all ${failed} account(s). Please try again.`,
        type: "error",
      });
    } else {
      toast({
        title: "Scans partially started",
        description: `Started ${succeeded} scan(s), ${failed} failed to start.`,
        type: "warning",
      });
    }
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["findings"] });
    queryClient.invalidateQueries({ queryKey: ["aws-accounts"] });
    queryClient.invalidateQueries({ queryKey: ["recent-scans"] });
  };

  const handleTriggerScan = (accountId: string) => {
    handleRescan(accountId);
  };

  const hasAccounts = accounts && accounts.length > 0;
  const hasCompletedScan = recentScans?.some(scan =>
    scan.status === "complete" || scan.status === "partial"
  );
  const hasScanInProgress = (activeScans && activeScans.length > 0) ||
    recentScans?.some(scan => ACTIVE_SCAN_STATUSES.includes(scan.status));

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="hidden rounded-lg bg-primary/10 p-2 sm:flex">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
              <span className="sm:hidden">Overview</span>
              <span className="hidden sm:inline">Organization Overview</span>
            </h1>
            <p className="text-sm text-muted-foreground sm:text-base">
              <span className="sm:hidden">{accounts?.length || 0} account{accounts?.length !== 1 ? "s" : ""}</span>
              <span className="hidden sm:inline">Aggregated view across all {accounts?.length || 0} AWS account{accounts?.length !== 1 ? "s" : ""}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasAccounts && !hasCompletedScan && (
            <Button
              variant="default"
              size="sm"
              onClick={() => setShowScanAllDialog(true)}
              disabled={triggerScan.isPending || hasScanInProgress}
            >
              <Play className="mr-2 h-4 w-4" />
              Scan All
            </Button>
          )}
          {hasCompletedScan && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isFetching}
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""} sm:mr-2`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          )}
        </div>
      </div>

      {/* No accounts state */}
      {!accountsLoading && !hasAccounts && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-primary/10 p-4">
              <Server className="h-8 w-8 text-primary" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">No AWS accounts connected</h3>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Connect your AWS accounts to start discovering resources and identifying
              security, cost, and compliance issues.
            </p>
            <Button className="mt-6" onClick={() => navigate("/accounts")}>
              <Settings className="mr-2 h-4 w-4" />
              Connect AWS Account
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Scanning in progress state */}
      {!accountsLoading && hasAccounts && !hasCompletedScan && hasScanInProgress && (
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-primary/20 p-5">
              <RefreshCw className="h-10 w-10 text-primary animate-spin" />
            </div>
            <h3 className="mt-6 text-xl font-semibold">Scanning your infrastructure...</h3>
            <p className="mt-3 max-w-lg text-muted-foreground">
              Your AWS account is being scanned. This may take a few minutes depending on
              the size of your infrastructure. The dashboard will update once the scan completes.
            </p>
            <Button
              variant="outline"
              size="lg"
              className="mt-8"
              onClick={() => navigate("/overview/scans")}
            >
              View Scan Progress
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Invitation to start first scan */}
      {!accountsLoading && hasAccounts && !hasCompletedScan && !hasScanInProgress && (
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-primary/20 p-5">
              <Scan className="h-10 w-10 text-primary" />
            </div>
            <h3 className="mt-6 text-xl font-semibold">Ready to scan your infrastructure</h3>
            <p className="mt-3 max-w-lg text-muted-foreground">
              Your AWS account is connected. Run your first scan to discover resources,
              identify security vulnerabilities, find cost optimization opportunities,
              and check compliance status.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button
                size="lg"
                onClick={() => setShowScanAllDialog(true)}
                disabled={triggerScan.isPending || hasScanInProgress}
              >
                <Play className="mr-2 h-5 w-5" />
                Start First Scan
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => navigate("/accounts")}
              >
                Manage Accounts
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dashboard content - only show after first scan is completed AND data is available */}
      {hasCompletedScan && summary && (
        <>
          {/* TIER 1: Critical Alert Banner */}
          <CriticalAlertBanner summary={summary} />

          {/* TIER 1: Status Cards */}
          <div className="grid gap-3 md:gap-4 md:grid-cols-3">
            <HealthScoreCard
              summary={summary}
              isLoading={summaryLoading}
            />
            <OpenIssuesCard
              summary={summary}
              isLoading={summaryLoading}
            />
            <ScanStatusCard
              accounts={accounts}
              activeScans={activeScans}
              recentScans={recentScans}
              onTriggerScan={handleTriggerScan}
              isTriggeringScan={triggerScan.isPending}
              isLoading={scansLoading}
            />
          </div>

          {/* TIER 2: Resource & Compliance */}
          <div className="grid gap-3 md:gap-4 md:grid-cols-2">
            <ResourceHealthCard
              summary={summary}
              isLoading={summaryLoading}
            />
            <ComplianceStatusCard
              summary={summary}
              isLoading={summaryLoading}
            />
          </div>

          {/* TIER 3: Cost & Activity */}
          <div className="grid gap-3 md:gap-4 md:grid-cols-2">
            <CostOptimizationCard
              summary={summary}
              isLoading={summaryLoading}
            />
            <RecentActivityCard
              scans={recentScans}
              accounts={accounts}
              actionedFindings={actionedFindings}
              isLoading={scansLoading}
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
                onClick={() => setShowScanAllDialog(true)}
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

      {/* Scan All confirmation dialog */}
      <Dialog open={showScanAllDialog} onOpenChange={setShowScanAllDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Scan All Accounts</DialogTitle>
            <DialogDescription>
              This will start a scan for all {accounts?.length || 0} connected AWS account(s).
              Scanning may take several minutes depending on the size of your infrastructure.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowScanAllDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                setShowScanAllDialog(false);
                handleScanAll();
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
