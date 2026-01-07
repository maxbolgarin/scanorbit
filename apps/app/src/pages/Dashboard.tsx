import { useState } from "react";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { RecentFindings } from "@/components/dashboard/RecentFindings";
import { RecommendedActions } from "@/components/dashboard/RecommendedActions";
import { AccountStatus } from "@/components/dashboard/AccountStatus";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { useDashboardSummary, useRecommendedActions } from "@/hooks/use-dashboard";
import { useFindings } from "@/hooks/use-findings";
import { useAwsAccounts, useTriggerScan } from "@/hooks/use-aws-accounts";
import { toast } from "@/hooks/use-toast";

export default function Dashboard() {
  const { data: summary, isLoading: summaryLoading } = useDashboardSummary();
  const { data: findings, isLoading: findingsLoading } = useFindings();
  const { data: actions, isLoading: actionsLoading } = useRecommendedActions();
  const { accounts, isLoading: accountsLoading } = useAwsAccounts();
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

  const isLoading = summaryLoading || findingsLoading || actionsLoading || accountsLoading;

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your AWS infrastructure health
        </p>
      </div>

      {summary && <SummaryCards summary={summary} />}

      <div className="grid gap-6 lg:grid-cols-2">
        {findings && <RecentFindings findings={findings} />}
        {actions && <RecommendedActions actions={actions} />}
      </div>

      <AccountStatus
        accounts={accounts}
        onRescan={handleRescan}
        isRescanning={rescanningAccount}
      />
    </div>
  );
}
