import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardSummaryCards } from "@/components/dashboard/DashboardSummaryCards";
import { SecurityHealthScore } from "@/components/dashboard/SecurityHealthScore";
import { QuickActionsPanel } from "@/components/dashboard/QuickActionsPanel";
import { RecentFindings } from "@/components/dashboard/RecentFindings";
import { AccountStatus } from "@/components/dashboard/AccountStatus";
import { RunningScans } from "@/components/dashboard/RunningScans";
import { ScanHistoryCard } from "@/components/dashboard/ScanHistoryCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useDashboardSummary, useRecommendedActions } from "@/hooks/use-dashboard";
import { useFindings } from "@/hooks/use-findings";
import { useAwsAccounts, useTriggerScan, useActiveScans, useRecentScans } from "@/hooks/use-aws-accounts";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  RefreshCw,
  Play,
  Server,
  AlertTriangle,
  Settings,
  ExternalLink,
} from "lucide-react";

export default function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: summary, isLoading: summaryLoading, isFetching } = useDashboardSummary();
  const { data: findings, isLoading: findingsLoading } = useFindings();
  const { data: actions, isLoading: actionsLoading } = useRecommendedActions();
  const { accounts, isLoading: accountsLoading } = useAwsAccounts();
  const { data: activeScans } = useActiveScans();
  const { data: recentScans } = useRecentScans(10);
  const triggerScan = useTriggerScan();
  const [rescanningAccount, setRescanningAccount] = useState<string | null>(null);

  const handleRescan = async (accountId: string) => {
    setRescanningAccount(accountId);
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
    } finally {
      setRescanningAccount(null);
    }
  };

  const handleScanAll = async () => {
    if (!accounts || accounts.length === 0) return;

    const results = await Promise.allSettled(
      accounts.map(account => triggerScan.mutateAsync(account.id))
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
  };

  const hasAccounts = accounts && accounts.length > 0;
  const hasAnyFindings = findings?.data && findings.data.length > 0;
  const openFindings = findings?.data?.filter(f => f.status === "open") || [];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of your AWS infrastructure health and security posture
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasAccounts && (
            <Button
              variant="default"
              size="sm"
              onClick={handleScanAll}
              disabled={triggerScan.isPending}
            >
              <Play className="mr-2 h-4 w-4" />
              Scan All
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isFetching}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
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
            <Button className="mt-6" onClick={() => navigate("/settings/accounts")}>
              <Settings className="mr-2 h-4 w-4" />
              Connect AWS Account
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Running scans notification */}
      {activeScans && activeScans.length > 0 && (
        <RunningScans scans={activeScans} accounts={accounts} />
      )}

      {/* Summary cards */}
      <DashboardSummaryCards summary={summary} isLoading={summaryLoading} />

      {/* Health score and Quick actions row */}
      <div className="grid gap-6 lg:grid-cols-2">
        <SecurityHealthScore summary={summary} isLoading={summaryLoading} />
        <QuickActionsPanel
          findings={actions || []}
          isLoading={actionsLoading}
        />
      </div>

      {/* Findings and Activity */}
      {hasAnyFindings && (
        <div className="grid gap-6 lg:grid-cols-2">
          <RecentFindings findings={findings?.data || []} />

          {/* Activity summary card */}
          <Card>
            <CardContent className="p-6">
              <h3 className="mb-4 text-base font-medium">Finding Summary</h3>
              <div className="space-y-4">
                {/* Severity breakdown */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-lg bg-red-500/10 p-3 text-center">
                    <div className="text-2xl font-bold text-red-500">
                      {openFindings.filter(f => f.severity === "high").length}
                    </div>
                    <div className="text-xs text-muted-foreground">High</div>
                  </div>
                  <div className="rounded-lg bg-yellow-500/10 p-3 text-center">
                    <div className="text-2xl font-bold text-yellow-500">
                      {openFindings.filter(f => f.severity === "medium").length}
                    </div>
                    <div className="text-xs text-muted-foreground">Medium</div>
                  </div>
                  <div className="rounded-lg bg-blue-500/10 p-3 text-center">
                    <div className="text-2xl font-bold text-blue-500">
                      {openFindings.filter(f => f.severity === "low").length}
                    </div>
                    <div className="text-xs text-muted-foreground">Low</div>
                  </div>
                </div>

                {/* Quick stats */}
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Total open findings</span>
                    <span className="font-medium">{openFindings.length}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Resolved this week</span>
                    <span className="font-medium text-green-500">
                      {findings?.data?.filter(f => f.status === "resolved").length || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Snoozed</span>
                    <span className="font-medium">
                      {findings?.data?.filter(f => f.status === "snoozed").length || 0}
                    </span>
                  </div>
                </div>

                {/* View all link */}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate("/findings")}
                >
                  View All Findings
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* No findings state */}
      {!findingsLoading && hasAccounts && !hasAnyFindings && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <div className="rounded-full bg-green-500/10 p-3">
              <AlertTriangle className="h-6 w-6 text-green-500" />
            </div>
            <h3 className="mt-3 font-medium">No findings yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Run a scan to discover issues in your infrastructure.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Scan history */}
      {recentScans && recentScans.length > 0 && (
        <ScanHistoryCard scans={recentScans} accounts={accounts} />
      )}

      {/* Account status */}
      {hasAccounts && (
        <AccountStatus
          accounts={accounts}
          onRescan={handleRescan}
          isRescanning={rescanningAccount}
        />
      )}
    </div>
  );
}
