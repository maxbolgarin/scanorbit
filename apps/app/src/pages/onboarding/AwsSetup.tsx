import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AwsAccountForm } from "@/components/onboarding/AwsAccountForm";
import { ScannerSelection } from "@/components/onboarding/ScannerSelection";
import { PolicyGuide } from "@/components/onboarding/PolicyGuide";
import { RoleGuide } from "@/components/onboarding/RoleGuide";
import { TestConnection } from "@/components/onboarding/TestConnection";
import { useAwsAccounts, useTriggerScan } from "@/hooks/use-aws-accounts";
import { Button } from "@/components/ui/button";
import { Cloud, Orbit, X } from "lucide-react";
import type { CreateAwsAccountInput, ScannerType } from "@/types";

type Step = "details" | "scanners" | "policy" | "role" | "connect";

const STORAGE_KEY = "scanorbit_aws_onboarding";

interface OnboardingState {
  step: Step;
  accountDetails: { name: string; awsAccountId: string; externalId: string } | null;
  selectedCategories?: string[];
  enabledScanners?: ScannerType[];
}

function loadOnboardingState(): OnboardingState | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

function saveOnboardingState(state: OnboardingState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors
  }
}

function clearOnboardingState() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

export default function AwsSetup() {
  const navigate = useNavigate();
  const { accounts, createAccount, testConnection, deleteAccount, isCreating, isTesting } = useAwsAccounts();
  const triggerScan = useTriggerScan();

  // Get existing account names and AWS Account IDs for validation
  const existingNames = accounts.map(a => a.name);
  const existingAwsAccountIds = accounts.map(a => a.awsAccountId);

  // Initialize state from localStorage
  const savedState = loadOnboardingState();
  const [step, setStep] = useState<Step>(savedState?.step || "details");
  const [accountDetails, setAccountDetails] = useState<{ name: string; awsAccountId: string; externalId: string } | null>(
    savedState?.accountDetails || null
  );
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    savedState?.selectedCategories || []
  );
  const [enabledScanners, setEnabledScanners] = useState<ScannerType[]>(
    savedState?.enabledScanners || []
  );
  const [createdAccountId, setCreatedAccountId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    saveOnboardingState({ step, accountDetails, selectedCategories, enabledScanners });
  }, [step, accountDetails, selectedCategories, enabledScanners]);

  // Clear localStorage when component unmounts if AWS account was successfully connected
  // This handles edge cases like browser navigation after successful connection
  useEffect(() => {
    return () => {
      // If we have a created account ID, the connection was successful
      // Clear localStorage to prevent stale data
      if (createdAccountId) {
        clearOnboardingState();
      }
    };
  }, [createdAccountId]);

  // Clear state and navigate to dashboard
  const handleClose = useCallback(() => {
    clearOnboardingState();
    navigate("/dashboard");
  }, [navigate]);

  const handleAccountDetails = async (data: { name: string; awsAccountId: string }) => {
    // Generate a unique external ID for this account connection
    const externalId = crypto.randomUUID();
    setAccountDetails({ ...data, externalId });
    setStep("scanners");
  };

  const handleScannerSelection = (categories: string[], scanners: ScannerType[]) => {
    setSelectedCategories(categories);
    setEnabledScanners(scanners);
    setStep("policy");
  };

  const handleTestConnection = async (roleArn: string): Promise<{ success: boolean; message: string }> => {
    if (!accountDetails) return { success: false, message: "No account details" };

    setError(null);
    try {
      let accountId = createdAccountId;
      let isNewAccount = false;

      // Only create account if we haven't already
      if (!accountId) {
        try {
          const input: CreateAwsAccountInput = {
            name: accountDetails.name,
            awsAccountId: accountDetails.awsAccountId,
            externalId: accountDetails.externalId,
            roleArn,
            enabledScanners: enabledScanners.length > 0 ? enabledScanners : undefined,
          };
          const account = await createAccount(input);
          accountId = account.id;
          isNewAccount = true;
        } catch (createErr) {
          const errorMessage = createErr instanceof Error ? createErr.message : "";

          // Show clear error for duplicate accounts instead of silently using existing
          if (errorMessage.toLowerCase().includes("already connected") ||
              errorMessage.toLowerCase().includes("already exists")) {
            return {
              success: false,
              message: "This AWS account is already connected to your organization. Please go back and enter a different AWS Account ID.",
            };
          }
          throw createErr;
        }
      }

      const result = await testConnection(accountId);

      if (result.success) {
        // Keep the account if test succeeded
        setCreatedAccountId(accountId);
      } else if (isNewAccount) {
        // Delete the account if test failed on a new account
        // so user can fix their IAM role and try again
        try {
          await deleteAccount(accountId);
        } catch {
          // Ignore delete errors
        }
      }

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Connection test failed";
      return { success: false, message };
    }
  };

  const handleConnect = async (roleArn: string) => {
    if (!accountDetails) return;
    setError(null);

    try {
      let accountId = createdAccountId;

      // Create account if not already created (shouldn't happen if test was run first)
      if (!accountId) {
        const input: CreateAwsAccountInput = {
          name: accountDetails.name,
          awsAccountId: accountDetails.awsAccountId,
          externalId: accountDetails.externalId,
          roleArn,
          enabledScanners: enabledScanners.length > 0 ? enabledScanners : undefined,
        };
        const account = await createAccount(input);
        accountId = account.id;
      }

      // Trigger initial scan first
      await triggerScan.mutateAsync(accountId);

      // Clear onboarding state only after everything succeeds
      // This ensures users can retry if scan trigger fails
      clearOnboardingState();

      // Go to dashboard - scan will be visible there
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect");
    }
  };

  const stepTitles: Record<Step, { title: string; description: string }> = {
    details: {
      title: "Connect AWS Account",
      description: "Enter your AWS account details to get started",
    },
    scanners: {
      title: "Configure Scanners",
      description: "Select which resources ScanOrbit should scan",
    },
    policy: {
      title: "Create IAM Policy",
      description: "Create a read-only IAM policy for ScanOrbit",
    },
    role: {
      title: "Create IAM Role",
      description: "Set up an IAM role and attach the policy",
    },
    connect: {
      title: "Connect Role",
      description: "Enter the Role ARN and test the connection",
    },
  };

  const stepNumber =
    step === "details" ? 1 :
    step === "scanners" ? 2 :
    step === "policy" ? 3 :
    step === "role" ? 4 : 5;

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="mb-8 flex items-center justify-center gap-2">
          <Orbit className="h-10 w-10 text-cyber-cyan" />
          <span className="text-2xl font-bold bg-gradient-to-r from-orbit-purple to-cyber-cyan bg-clip-text text-transparent">
            ScanOrbit
          </span>
        </div>

        {/* Progress indicator */}
        <div className="mb-6 flex items-center justify-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
            1
          </div>
          <div className="h-0.5 w-6 bg-primary" />
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
              stepNumber >= 2
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            2
          </div>
          <div className={`h-0.5 w-6 ${stepNumber >= 2 ? "bg-primary" : "bg-muted"}`} />
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
              stepNumber >= 3
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            3
          </div>
          <div className={`h-0.5 w-6 ${stepNumber >= 3 ? "bg-primary" : "bg-muted"}`} />
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
              stepNumber >= 4
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            4
          </div>
          <div className={`h-0.5 w-6 ${stepNumber >= 4 ? "bg-primary" : "bg-muted"}`} />
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
              stepNumber >= 5
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            5
          </div>
        </div>

        <Card className="relative">
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-2 h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={handleClose}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Cloud className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>{stepTitles[step].title}</CardTitle>
            <CardDescription>{stepTitles[step].description}</CardDescription>
          </CardHeader>
          <CardContent>
            {step === "details" && (
              <AwsAccountForm
                onSubmit={handleAccountDetails}
                isLoading={false}
                error={error}
                existingNames={existingNames}
                existingAwsAccountIds={existingAwsAccountIds}
              />
            )}
            {step === "scanners" && (
              <ScannerSelection
                onSelect={handleScannerSelection}
                onBack={() => setStep("details")}
                initialCategories={selectedCategories.length > 0 ? selectedCategories : undefined}
              />
            )}
            {step === "policy" && (
              <PolicyGuide
                selectedCategories={selectedCategories}
                onNext={() => setStep("role")}
                onBack={() => setStep("scanners")}
              />
            )}
            {step === "role" && accountDetails && (
              <RoleGuide
                externalId={accountDetails.externalId}
                onNext={() => setStep("connect")}
                onBack={() => setStep("policy")}
              />
            )}
            {step === "connect" && accountDetails && (
              <TestConnection
                awsAccountId={accountDetails.awsAccountId}
                onTest={handleTestConnection}
                onSubmit={handleConnect}
                onBack={() => setStep("role")}
                isLoading={isCreating || isTesting || triggerScan.isPending}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
