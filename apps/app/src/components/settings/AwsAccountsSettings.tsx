import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useAwsAccounts } from "@/hooks/use-aws-accounts";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import {
  PERMISSION_CATEGORIES,
  getCategoriesFromScanners,
  getScannersFromCategories,
  type ScannerType,
} from "@/types";
import * as api from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import {
  Server,
  Database,
  HardDrive,
  Network,
  Shield,
  Zap,
  Activity,
  Users,
  Key,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Save,
  X,
} from "lucide-react";

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  ec2_compute: Server,
  database: Database,
  storage: HardDrive,
  networking: Network,
  certificates: Shield,
  serverless: Zap,
  monitoring: Activity,
  identity: Users,
  secrets: Key,
};

export function AwsAccountsSettings() {
  const { accounts, isLoading } = useAwsAccounts();
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [expandedAccountId, setExpandedAccountId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <LoadingSpinner />
        </CardContent>
      </Card>
    );
  }

  if (!accounts || accounts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>AWS Accounts</CardTitle>
          <CardDescription>
            Configure scanner settings for your connected AWS accounts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No AWS accounts connected. Add an AWS account to configure scanners.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>AWS Accounts</CardTitle>
          <CardDescription>
            Configure which resources to scan for each connected AWS account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="rounded-lg border p-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{account.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {account.awsAccountId}
                    </Badge>
                    <Badge
                      variant={account.status === "ok" ? "default" : "destructive"}
                      className="text-xs"
                    >
                      {account.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {account.enabledScanners?.length || 0} of 11 scanners enabled
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {editingAccountId === account.id ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingAccountId(null)}
                    >
                      Cancel
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setExpandedAccountId(
                            expandedAccountId === account.id ? null : account.id
                          );
                        }}
                      >
                        {expandedAccountId === account.id ? (
                          <>
                            <ChevronUp className="h-4 w-4 mr-1" />
                            Hide
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-4 w-4 mr-1" />
                            View
                          </>
                        )}
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => setEditingAccountId(account.id)}
                      >
                        Configure
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Expanded view - show current scanners */}
              {expandedAccountId === account.id && editingAccountId !== account.id && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm font-medium mb-2">Enabled Scanners:</p>
                  <div className="flex flex-wrap gap-1">
                    {account.enabledScanners?.map((scanner) => (
                      <Badge key={scanner} variant="secondary" className="text-xs">
                        {scanner}
                      </Badge>
                    )) || (
                      <span className="text-sm text-muted-foreground">
                        All scanners enabled
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Editing view */}
              {editingAccountId === account.id && (
                <ScannerConfiguration
                  accountId={account.id}
                  currentScanners={account.enabledScanners || []}
                  onClose={() => setEditingAccountId(null)}
                />
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

interface ScannerConfigurationProps {
  accountId: string;
  currentScanners: ScannerType[];
  onClose: () => void;
}

function ScannerConfiguration({
  accountId,
  currentScanners,
  onClose,
}: ScannerConfigurationProps) {
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Derive selected categories from current scanners
  const initialCategories = getCategoriesFromScanners(currentScanners);
  const [selected, setSelected] = useState<string[]>(
    initialCategories.length > 0
      ? initialCategories
      : PERMISSION_CATEGORIES.map((c) => c.id) // All if empty
  );

  const toggleCategory = (categoryId: string) => {
    setSelected((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handleSave = async () => {
    const enabledScanners = getScannersFromCategories(selected);

    if (enabledScanners.length === 0) {
      setError("At least one scanner category must be enabled");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await api.updateAwsAccountScanners(accountId, enabledScanners);
      // Invalidate AWS accounts query to refresh data
      queryClient.invalidateQueries({ queryKey: ["awsAccounts"] });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update scanners");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mt-4 pt-4 border-t space-y-4">
      {/* Warning about IAM policy */}
      <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3 text-sm flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-medium text-yellow-600">IAM Policy Update Required</p>
          <p className="text-muted-foreground">
            If you enable additional scanners, you may need to update your IAM policy
            in AWS to grant the required permissions.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Category selection */}
      <div className="grid gap-2 max-h-[300px] overflow-y-auto pr-1">
        {PERMISSION_CATEGORIES.map((category) => {
          const Icon = CATEGORY_ICONS[category.id] || Server;
          const isSelected = selected.includes(category.id);

          return (
            <div
              key={category.id}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                isSelected
                  ? "border-primary bg-primary/5"
                  : "hover:bg-muted/50"
              }`}
              onClick={() => toggleCategory(category.id)}
            >
              <Checkbox
                checked={isSelected}
                onChange={() => toggleCategory(category.id)}
                onClick={(e) => e.stopPropagation()}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="font-medium text-sm">{category.label}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {category.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="text-sm text-muted-foreground">
        {selected.length} of {PERMISSION_CATEGORIES.length} categories selected
        ({getScannersFromCategories(selected).length} scanners)
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button variant="outline" onClick={onClose} disabled={isSaving}>
          <X className="h-4 w-4 mr-1" />
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={isSaving || selected.length === 0}
        >
          {isSaving ? (
            <>
              <LoadingSpinner size="sm" className="mr-1" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-1" />
              Save Configuration
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
