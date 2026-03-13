import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AccountStatusBadge } from "@/components/shared/StatusBadge";
import { formatRelativeTime } from "@/lib/utils";
import { Cloud, Plus } from "lucide-react";
import type { AwsAccount } from "@/types";

interface AccountStatusProps {
  accounts: AwsAccount[];
}

export function AccountStatus({ accounts }: AccountStatusProps) {
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5 text-status-info" />
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
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
