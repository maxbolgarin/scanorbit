import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import {
  PERMISSION_CATEGORIES,
  getCategoriesFromScanners,
  getScannersFromCategories,
  generateIAMPolicy,
  type ScannerType,
} from "@/types";
import * as api from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { useAwsAccounts } from "@/hooks/use-aws-accounts";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  Save,
  X,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
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

interface ScannerConfigModalProps {
  accountId: string;
  accountName: string;
  currentScanners: ScannerType[];
  open: boolean;
  onClose: () => void;
}

export function ScannerConfigModal({
  accountId,
  accountName,
  currentScanners,
  open,
  onClose,
}: ScannerConfigModalProps) {
  const queryClient = useQueryClient();
  const { testConnection } = useAwsAccounts();
  const [step, setStep] = useState<"select" | "update-policy">("select");
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [copiedPolicy, setCopiedPolicy] = useState(false);
  const [policyExpanded, setPolicyExpanded] = useState(true);

  // Derive selected categories from current scanners
  const initialCategories = getCategoriesFromScanners(currentScanners);
  const [selected, setSelected] = useState<string[]>(
    initialCategories.length > 0
      ? initialCategories
      : PERMISSION_CATEGORIES.map((c) => c.id)
  );

  // Track previous open state to detect when modal opens
  const prevOpenRef = useRef(open);

  // Only reset state when modal opens (not when currentScanners changes while open)
  useEffect(() => {
    // Only run when modal transitions from closed to open
    if (open && !prevOpenRef.current) {
      const categories = getCategoriesFromScanners(currentScanners);
      setSelected(categories.length > 0 ? categories : PERMISSION_CATEGORIES.map((c) => c.id));
      setStep("select");
      setError(null);
      setTestResult(null);
    }
    prevOpenRef.current = open;
  }, [open, currentScanners]);

  // Check if there are any changes from the initial configuration
  const hasChanges = selected.length !== initialCategories.length ||
    selected.some((cat) => !initialCategories.includes(cat)) ||
    initialCategories.some((cat) => !selected.includes(cat));

  // Generate the new policy based on selected categories
  const allCategoryIds = PERMISSION_CATEGORIES.map((c) => c.id);
  const hasCustomSelection = selected.length > 0 && selected.length < allCategoryIds.length;
  const newPolicy = hasCustomSelection ? generateIAMPolicy(selected) : generateIAMPolicy(allCategoryIds);

  const toggleCategory = (categoryId: string) => {
    setSelected((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handleCopyPolicy = async () => {
    await navigator.clipboard.writeText(newPolicy);
    setCopiedPolicy(true);
    setTimeout(() => setCopiedPolicy(false), 2000);
  };

  const handleSave = async () => {
    const enabledScanners = getScannersFromCategories(selected);

    if (enabledScanners.length === 0) {
      setError("At least one scanner category must be enabled");
      return;
    }

    // Capture this value BEFORE the refetch, as it will change after
    // the component re-renders with updated currentScanners
    const shouldShowPolicyStep = hasChanges;

    setIsSaving(true);
    setError(null);

    try {
      await api.updateAwsAccountScanners(accountId, enabledScanners);
      await queryClient.refetchQueries({ queryKey: ["aws-accounts"] });

      if (shouldShowPolicyStep) {
        setStep("update-policy");
      } else {
        handleClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update scanners");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      const result = await testConnection(accountId);
      setTestResult(result);
      if (result.success) {
        await queryClient.refetchQueries({ queryKey: ["aws-accounts"] });
      }
    } catch (err) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : "Connection test failed",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleClose = () => {
    setStep("select");
    setError(null);
    setTestResult(null);
    // Reset selected to current values
    const categories = getCategoriesFromScanners(currentScanners);
    setSelected(categories.length > 0 ? categories : PERMISSION_CATEGORIES.map((c) => c.id));
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === "select" ? "Configure Scanners" : "Update IAM Policy"}
          </DialogTitle>
          <DialogDescription>
            {step === "select"
              ? `Configure which resources to scan for ${accountName}`
              : "Update your IAM policy in AWS to grant permissions for new scanners"
            }
          </DialogDescription>
        </DialogHeader>

        {step === "select" ? (
          <div className="space-y-4 mt-4">
            {/* Warning about IAM policy */}
            {hasChanges && (
              <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3 text-sm flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-yellow-600">IAM Policy Update Required</p>
                  <p className="text-muted-foreground">
                    After saving, you'll need to update your IAM policy in AWS to match the new configuration.
                  </p>
                </div>
              </div>
            )}

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
                const isNew = isSelected && !initialCategories.includes(category.id);

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
                        {isNew && (
                          <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-600">
                            New
                          </Badge>
                        )}
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
            <div className="flex gap-2 pt-2 border-t">
              <Button variant="outline" onClick={handleClose} disabled={isSaving}>
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving || selected.length === 0}
                className="flex-1"
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
        ) : (
          <div className="space-y-4 mt-4">
            <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-3 text-sm flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-green-600">Configuration Saved</p>
                <p className="text-muted-foreground">
                  Now update your IAM policy to set the required permissions.
                </p>
              </div>
            </div>

            {/* Step 1: Open IAM */}
            <div className="rounded-lg border p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                  1
                </div>
                <div className="flex-1 space-y-2">
                  <p className="font-medium">Open IAM Policies in AWS Console</p>
                  <a
                    href="https://console.aws.amazon.com/iam/home#/policies"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                  >
                    Click here to open IAM Policies
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            </div>

            {/* Step 2: Find policy */}
            <div className="rounded-lg border p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                  2
                </div>
                <div className="flex-1 space-y-2">
                  <p className="font-medium">Find and edit the ScanOrbit policy</p>
                  <p className="text-sm text-muted-foreground">
                    Search for <span className="font-mono font-medium text-foreground">ScanOrbitReadOnlyPolicy</span>,
                    click on it, then click <span className="font-medium text-foreground">"Edit"</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Step 3: Replace policy */}
            <div className="rounded-lg border p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                  3
                </div>
                <div className="flex-1 space-y-3">
                  <p className="font-medium">Replace the policy JSON</p>
                  <p className="text-sm text-muted-foreground">
                    Click the <span className="font-medium text-foreground">"JSON"</span> tab,
                    select all content and replace with the new policy:
                  </p>

                  <Collapsible open={policyExpanded} onOpenChange={setPolicyExpanded}>
                    <CollapsibleTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full justify-between">
                        <span>{policyExpanded ? "Hide" : "Show"} policy JSON</span>
                        <ChevronDown className={`h-4 w-4 transition-transform ${policyExpanded ? "rotate-180" : ""}`} />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-3">
                      <Card>
                        <CardContent className="p-3">
                          <div className="mb-2 flex justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleCopyPolicy}
                            >
                              {copiedPolicy ? (
                                <>
                                  <Check className="mr-1 h-4 w-4 text-green-500" />
                                  Copied!
                                </>
                              ) : (
                                <>
                                  <Copy className="mr-1 h-4 w-4" />
                                  Copy Policy
                                </>
                              )}
                            </Button>
                          </div>
                          <pre className="overflow-x-auto text-xs text-muted-foreground max-h-[200px] bg-muted/50 p-3 rounded">
                            {newPolicy}
                          </pre>
                        </CardContent>
                      </Card>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              </div>
            </div>

            {/* Step 4: Save */}
            <div className="rounded-lg border p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                  4
                </div>
                <div className="flex-1 space-y-2">
                  <p className="font-medium">Save the policy</p>
                  <p className="text-sm text-muted-foreground">
                    Click <span className="font-medium text-foreground">"Next"</span>,
                    then <span className="font-medium text-foreground">"Save changes"</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Step 5: Test Connection */}
            <div className="rounded-lg border p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                  5
                </div>
                <div className="flex-1 space-y-3">
                  <p className="font-medium">Verify the connection (optional)</p>
                  <p className="text-sm text-muted-foreground">
                    Test that ScanOrbit can still access your account:
                  </p>

                  {testResult && (
                    <div className={`rounded-lg border p-3 text-sm flex items-start gap-2 ${
                      testResult.success
                        ? "border-green-500/50 bg-green-500/10"
                        : "border-red-500/50 bg-red-500/10"
                    }`}>
                      {testResult.success ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                      )}
                      <div>
                        <p className={`font-medium ${testResult.success ? "text-green-600" : "text-red-600"}`}>
                          {testResult.success ? "Connection Successful" : "Connection Failed"}
                        </p>
                        <p className="text-muted-foreground">{testResult.message}</p>
                      </div>
                    </div>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleTestConnection}
                    disabled={isTesting}
                  >
                    {isTesting ? (
                      <>
                        <LoadingSpinner size="sm" className="mr-1" />
                        Testing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-1" />
                        Test Connection
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button onClick={handleClose}>
                Done
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
