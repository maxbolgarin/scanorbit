import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AccountsTable } from "@/components/accounts/AccountsTable";
import { ScanHistory } from "@/components/accounts/ScanHistory";
import { ScannerConfigModal } from "@/components/accounts/ScannerConfigModal";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { useAwsAccounts } from "@/hooks/use-aws-accounts";
import { useAuthStore } from "@/stores/auth-store";
import { useAccountContextStore } from "@/stores/account-context-store";
import { toast } from "@/hooks/use-toast";
import { TIER_LIMITS } from "@/types";
import { Cloud, Plus, Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";

export default function Accounts() {
  const navigate = useNavigate();
  const { accounts, isLoading, deleteAccount } = useAwsAccounts();
  const { org } = useAuthStore();
  const { currentAccountId, clearAccountContext, setCurrentAccount } = useAccountContextStore();

  const tier = org?.tier || 'free';
  const isTeamTier = tier === 'team';
  const canViewOrgOverview = TIER_LIMITS[tier].canViewOrgOverview;

  const [editAccountId, setEditAccountId] = useState<string | null>(null);
  const [historyAccountId, setHistoryAccountId] = useState<string | null>(null);
  const [disconnectAccountId, setDisconnectAccountId] = useState<string | null>(null);

  const handleDisconnect = async () => {
    if (!disconnectAccountId) return;

    const wasCurrentAccount = currentAccountId === disconnectAccountId;
    const remainingAccounts = accounts.filter(a => a.id !== disconnectAccountId);

    try {
      await deleteAccount(disconnectAccountId);
      toast({
        title: "Account disconnected",
        description: "The AWS account has been disconnected.",
        type: "success",
      });

      // Handle navigation if deleted account was current
      if (wasCurrentAccount) {
        clearAccountContext();

        if (remainingAccounts.length === 0) {
          // Stay on accounts page - shows empty state with "Add Account" CTA
          // No navigation needed
        } else if (canViewOrgOverview) {
          navigate("/overview", { replace: true });
        } else {
          setCurrentAccount(remainingAccounts[0].id);
          navigate(`/accounts/${remainingAccounts[0].id}`, { replace: true });
        }
      }
    } catch {
      toast({
        title: "Disconnect failed",
        description: "Failed to disconnect account. Please try again.",
        type: "error",
      });
    } finally {
      setDisconnectAccountId(null);
    }
  };

  const editAccount = accounts.find((a) => a.id === editAccountId);
  const historyAccount = accounts.find((a) => a.id === historyAccountId);
  const disconnectAccountData = accounts.find((a) => a.id === disconnectAccountId);

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">AWS Accounts</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Manage your connected AWS accounts
          </p>
        </div>
        {isTeamTier && (
          <Button onClick={() => navigate("/onboarding/aws")} size="sm" className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            Add Account
          </Button>
        )}
      </div>

      {/* Info banner for non-team users */}
      {!isTeamTier && (
        <Card className="border-dashed bg-muted/30">
          <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start sm:items-center gap-3">
              <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5 sm:mt-0" />
              <div>
                <p className="text-sm font-medium">Want to manage multiple AWS accounts?</p>
                <p className="text-xs text-muted-foreground">
                  Upgrade to Team to connect unlimited AWS accounts
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate("/settings?tab=subscription")} className="w-full sm:w-auto">
              Upgrade to Team
            </Button>
          </CardContent>
        </Card>
      )}

      {accounts.length > 0 ? (
        <AccountsTable
          accounts={accounts}
          onEdit={setEditAccountId}
          onViewHistory={setHistoryAccountId}
          onDisconnect={setDisconnectAccountId}
        />
      ) : (
        <EmptyState
          icon={Cloud}
          title="No AWS accounts connected"
          description="Connect your first AWS account to start scanning your infrastructure"
          actionLabel="Add Account"
          onAction={() => navigate("/onboarding/aws")}
        />
      )}

      {/* Scanner Configuration Modal */}
      {editAccount && (
        <ScannerConfigModal
          accountId={editAccount.id}
          accountName={editAccount.name}
          currentScanners={editAccount.enabledScanners || []}
          open={!!editAccountId}
          onClose={() => setEditAccountId(null)}
        />
      )}

      {/* Scan History Modal */}
      <ScanHistory
        accountId={historyAccountId}
        accountName={historyAccount?.name}
        onClose={() => setHistoryAccountId(null)}
      />

      {/* Disconnect Confirmation */}
      <Dialog
        open={!!disconnectAccountId}
        onOpenChange={() => setDisconnectAccountId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disconnect AWS Account?</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Are you sure you want to disconnect{" "}
                  <strong>{disconnectAccountData?.name}</strong> (
                  {disconnectAccountData?.awsAccountId})?
                </p>
                <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm">
                  <p className="font-medium text-destructive">This action will permanently delete:</p>
                  <ul className="mt-2 list-inside list-disc space-y-1 text-muted-foreground">
                    <li>All scan history for this account</li>
                    <li>All discovered resources</li>
                    <li>All security findings</li>
                    <li>All analysis results</li>
                  </ul>
                </div>
                <p className="text-sm text-muted-foreground">
                  This action cannot be undone.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDisconnectAccountId(null)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDisconnect}>
              Disconnect Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
