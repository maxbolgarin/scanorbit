import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AccountsTable } from "@/components/accounts/AccountsTable";
import { ScanHistory } from "@/components/accounts/ScanHistory";
import { ScannerConfigModal } from "@/components/accounts/ScannerConfigModal";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { AccountStatusBadge } from "@/components/shared/StatusBadge";
import { useAwsAccounts } from "@/hooks/use-aws-accounts";
import { useAuthStore } from "@/stores/auth-store";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { useAccountContextStore } from "@/stores/account-context-store";
import { toast } from "@/hooks/use-toast";
import { TIER_LIMITS, ALL_SCANNER_TYPES } from "@/types";
import type { AwsAccount } from "@/types";
import { formatRelativeTime, formatDateTime } from "@/lib/utils";
import { Cloud, Plus, Info, LayoutDashboard, History, ScanLine, Settings2, AlertTriangle, Copy, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

function AccountDetailModal({
  account,
  onClose,
  onEdit,
  onViewHistory,
  isAdmin,
}: {
  account: AwsAccount | null;
  onClose: () => void;
  onEdit?: (id: string) => void;
  onViewHistory: (id: string) => void;
  isAdmin: boolean;
}) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  if (!account) return null;

  const copyArn = () => {
    navigator.clipboard.writeText(account.roleArn);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={!!account} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5 text-primary" />
            {account.name}
          </DialogTitle>
          <DialogDescription className="font-mono text-xs">{account.awsAccountId}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status</span>
            <AccountStatusBadge status={account.status} />
          </div>

          {/* Error */}
          {account.status === "error" && account.lastError && (
            <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-destructive break-words">{account.lastError}</p>
            </div>
          )}

          <Separator />

          {/* Connection */}
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Connection</p>
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm text-muted-foreground shrink-0">Role ARN</span>
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-xs font-mono text-right truncate max-w-[260px]" title={account.roleArn}>
                  {account.roleArn}
                </span>
                <button onClick={copyArn} className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
                  {copied ? <Check className="h-3.5 w-3.5 text-status-success" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
            {account.externalId && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">External ID</span>
                <span className="text-xs font-mono">{account.externalId}</span>
              </div>
            )}
          </div>

          <Separator />

          {/* Scan info */}
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Scan Info</p>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Last scan</span>
              <span className="text-sm">
                {account.lastScanAt ? formatRelativeTime(account.lastScanAt) : "Never"}
              </span>
            </div>
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm text-muted-foreground shrink-0">
                Scanners ({account.enabledScanners.length}/{ALL_SCANNER_TYPES.length})
              </span>
              <div className="flex flex-wrap gap-1 justify-end">
                {account.enabledScanners.map((s) => (
                  <Badge key={s} variant="secondary" className="text-xs py-0">{s}</Badge>
                ))}
              </div>
            </div>
          </div>

          <Separator />

          {/* Timestamps */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Connected</span>
              <span className="text-sm">{formatDateTime(account.createdAt)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Updated</span>
              <span className="text-sm">{formatDateTime(account.updatedAt)}</span>
            </div>
          </div>

          <Separator />

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <button
              className="flex items-center gap-1.5 text-xs py-1.5 px-3 rounded border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
              onClick={() => { onClose(); navigate(`/accounts/${account.id}`); }}
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              Dashboard
            </button>
            <button
              className="flex items-center gap-1.5 text-xs py-1.5 px-3 rounded border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
              onClick={() => { onClose(); navigate(`/accounts/${account.id}/scans`); }}
            >
              <ScanLine className="h-3.5 w-3.5" />
              Scans
            </button>
            <button
              className="flex items-center gap-1.5 text-xs py-1.5 px-3 rounded border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
              onClick={() => { onClose(); onViewHistory(account.id); }}
            >
              <History className="h-3.5 w-3.5" />
              Scan History
            </button>
            {isAdmin && onEdit && (
              <button
                className="flex items-center gap-1.5 text-xs py-1.5 px-3 rounded border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                onClick={() => { onClose(); onEdit(account.id); }}
              >
                <Settings2 className="h-3.5 w-3.5" />
                Edit Scanners
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Accounts() {
  const navigate = useNavigate();
  const { accounts, isLoading, deleteAccount } = useAwsAccounts();
  const { org } = useAuthStore();
  const isAdmin = useIsAdmin();
  const { currentAccountId, clearAccountContext, setCurrentAccount } = useAccountContextStore();

  const tier = org?.tier || 'free';
  const isTeamTier = tier === 'team';
  const canViewOrgOverview = TIER_LIMITS[tier].canViewOrgOverview;

  const [editAccountId, setEditAccountId] = useState<string | null>(null);
  const [historyAccountId, setHistoryAccountId] = useState<string | null>(null);
  const [disconnectAccountId, setDisconnectAccountId] = useState<string | null>(null);
  const [detailAccount, setDetailAccount] = useState<AwsAccount | null>(null);

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
        {isTeamTier && isAdmin && (
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
          onEdit={isAdmin ? setEditAccountId : undefined}
          onViewHistory={setHistoryAccountId}
          onDisconnect={isAdmin ? setDisconnectAccountId : undefined}
          onViewDetails={setDetailAccount}
        />
      ) : (
        <EmptyState
          icon={Cloud}
          title="No AWS accounts connected"
          description={isAdmin ? "Connect your first AWS account to start scanning your infrastructure" : "No AWS accounts have been connected yet"}
          actionLabel={isAdmin ? "Add Account" : undefined}
          onAction={isAdmin ? () => navigate("/onboarding/aws") : undefined}
        />
      )}

      {/* Account Detail Modal */}
      <AccountDetailModal
        account={detailAccount}
        onClose={() => setDetailAccount(null)}
        onEdit={isAdmin ? setEditAccountId : undefined}
        onViewHistory={setHistoryAccountId}
        isAdmin={isAdmin}
      />

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
