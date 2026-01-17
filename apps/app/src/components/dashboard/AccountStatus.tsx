import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AccountStatusBadge } from "@/components/shared/StatusBadge";
import { formatRelativeTime } from "@/lib/utils";
import { Cloud, Plus, RefreshCw } from "lucide-react";
import type { AwsAccount } from "@/types";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";

interface AccountStatusProps {
  accounts: AwsAccount[];
  onRescan: (accountId: string) => void;
  isRescanning?: string | null;
}

export function AccountStatus({ accounts, onRescan, isRescanning }: AccountStatusProps) {
  const navigate = useNavigate();
  const [rescanAccount, setRescanAccount] = useState<AwsAccount | null>(null);

  const handleRescanConfirm = () => {
    if (rescanAccount) {
      onRescan(rescanAccount.id);
      setRescanAccount(null);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5 text-blue-500" />
            AWS Accounts
          </CardTitle>
          <CardDescription>Connected accounts and scan status</CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("/accounts")}
        >
          <Plus className="mr-1 h-4 w-4" />
          Add Account
        </Button>
      </CardHeader>
      <CardContent>
        {accounts.length === 0 ? (
          <div className="py-8 text-center">
            <Cloud className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-muted-foreground">No AWS accounts connected</p>
            <Button
              variant="link"
              onClick={() => navigate("/onboarding/aws")}
              className="mt-2"
            >
              Connect your first account
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {accounts.map((account) => (
              <div
                key={account.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{account.name}</span>
                    <AccountStatusBadge status={account.status} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {account.awsAccountId}
                  </p>
                  {account.lastScanAt && (
                    <p className="text-xs text-muted-foreground">
                      Last scan: {formatRelativeTime(account.lastScanAt)}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setRescanAccount(account)}
                  disabled={isRescanning === account.id || account.status !== "ok"}
                >
                  {isRescanning === account.id ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    <>
                      <RefreshCw className="mr-1 h-4 w-4" />
                      Rescan
                    </>
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Rescan confirmation dialog */}
      <Dialog open={!!rescanAccount} onOpenChange={(open) => !open && setRescanAccount(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Rescan</DialogTitle>
            <DialogDescription>
              Are you sure you want to rescan{" "}
              <span className="font-medium text-foreground">{rescanAccount?.name}</span>?
              This will scan all resources in the AWS account and may take a few minutes.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRescanAccount(null)}>
              Cancel
            </Button>
            <Button onClick={handleRescanConfirm}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Start Rescan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
