import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AccountsTable } from "@/components/accounts/AccountsTable";
import { ScanHistory } from "@/components/accounts/ScanHistory";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { useAwsAccounts, useTriggerScan } from "@/hooks/use-aws-accounts";
import { toast } from "@/hooks/use-toast";
import { Cloud, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function Accounts() {
  const navigate = useNavigate();
  const { accounts, isLoading, disconnectAccount } = useAwsAccounts();
  const triggerScan = useTriggerScan();

  const [rescanningId, setRescanningId] = useState<string | null>(null);
  const [historyAccountId, setHistoryAccountId] = useState<string | null>(null);
  const [disconnectAccountId, setDisconnectAccountId] = useState<string | null>(null);

  const handleRescan = async (accountId: string) => {
    setRescanningId(accountId);
    try {
      await triggerScan.mutateAsync(accountId);
      toast({
        title: "Scan started",
        description: "Your AWS account is being scanned.",
        type: "success",
      });
    } catch {
      toast({
        title: "Scan failed",
        description: "Failed to start scan. Please try again.",
        type: "error",
      });
    } finally {
      setRescanningId(null);
    }
  };

  const handleDisconnect = async () => {
    if (!disconnectAccountId) return;
    try {
      await disconnectAccount(disconnectAccountId);
      toast({
        title: "Account disconnected",
        description: "The AWS account has been disconnected.",
        type: "success",
      });
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
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">AWS Accounts</h1>
          <p className="text-muted-foreground">
            Manage your connected AWS accounts
          </p>
        </div>
        <Button onClick={() => navigate("/onboarding/aws")}>
          <Plus className="mr-2 h-4 w-4" />
          Add Account
        </Button>
      </div>

      {accounts.length > 0 ? (
        <AccountsTable
          accounts={accounts}
          onRescan={handleRescan}
          onViewHistory={setHistoryAccountId}
          onDisconnect={setDisconnectAccountId}
          rescanningId={rescanningId}
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
            <DialogDescription>
              Are you sure you want to disconnect{" "}
              <strong>{disconnectAccountData?.name}</strong> (
              {disconnectAccountData?.awsAccountId})? This will remove all
              associated resources and findings from ScanOrbit.
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
              Disconnect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
