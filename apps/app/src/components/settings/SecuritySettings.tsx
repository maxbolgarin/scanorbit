import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAwsAccounts } from "@/hooks/use-aws-accounts";
import { AccountStatusBadge } from "@/components/shared/StatusBadge";
import { Shield, Cloud, Smartphone, Key } from "lucide-react";

export function SecuritySettings() {
  const { accounts } = useAwsAccounts();

  return (
    <div className="space-y-6">
      {/* 2FA - Future feature */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Two-Factor Authentication
          </CardTitle>
          <CardDescription>
            Add an extra layer of security to your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="font-medium">2FA Status</p>
              <p className="text-sm text-muted-foreground">
                Protect your account with two-factor authentication
              </p>
            </div>
            <Badge variant="secondary">Coming Soon</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Connected AWS Accounts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            Connected AWS Accounts
          </CardTitle>
          <CardDescription>
            IAM roles with access to your AWS infrastructure
          </CardDescription>
        </CardHeader>
        <CardContent>
          {accounts.length > 0 ? (
            <div className="space-y-3">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="space-y-1">
                    <p className="font-medium">{account.name}</p>
                    <p className="text-sm text-muted-foreground font-mono">
                      {account.awsAccountId}
                    </p>
                    <p className="text-xs text-muted-foreground break-all">
                      {account.roleArn}
                    </p>
                  </div>
                  <AccountStatusBadge status={account.status} />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No AWS accounts connected</p>
          )}
        </CardContent>
      </Card>

      {/* Security Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Overview
          </CardTitle>
          <CardDescription>Your account security status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="h-4 w-4 text-muted-foreground" />
                <span>Password set</span>
              </div>
              <Badge variant="success">Active</Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-muted-foreground" />
                <span>Two-factor authentication</span>
              </div>
              <Badge variant="secondary">Not enabled</Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cloud className="h-4 w-4 text-muted-foreground" />
                <span>AWS connections</span>
              </div>
              <Badge variant="secondary">
                {accounts.length} account{accounts.length !== 1 ? "s" : ""}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
