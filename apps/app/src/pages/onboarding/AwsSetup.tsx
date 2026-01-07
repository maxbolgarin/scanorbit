import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AwsAccountForm } from "@/components/onboarding/AwsAccountForm";
import { PolicyGuide } from "@/components/onboarding/PolicyGuide";
import { TestConnection } from "@/components/onboarding/TestConnection";
import { useAwsAccounts, useTriggerScan } from "@/hooks/use-aws-accounts";
import { Cloud } from "lucide-react";
import type { AwsAccount } from "@/types";

type Step = "details" | "policy" | "connect";

export default function AwsSetup() {
  const navigate = useNavigate();
  const { createAccount, testConnection, connectRole, isCreating, isConnecting } =
    useAwsAccounts();
  const triggerScan = useTriggerScan();

  const [step, setStep] = useState<Step>("details");
  const [account, setAccount] = useState<AwsAccount | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCreateAccount = async (data: { name: string; awsAccountId: string }) => {
    setError(null);
    try {
      const newAccount = await createAccount(data);
      setAccount(newAccount);
      setStep("policy");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create account");
    }
  };

  const handleTestConnection = async (_roleArn: string) => {
    if (!account) return { success: false, message: "No account" };
    return await testConnection(account.id);
  };

  const handleConnect = async (roleArn: string) => {
    if (!account) return;
    setError(null);
    try {
      const connectedAccount = await connectRole(account.id, { roleArn });
      // Trigger initial scan
      const scan = await triggerScan.mutateAsync(connectedAccount.id);
      navigate(`/onboarding/scan/${scan.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect");
    }
  };

  const stepTitles: Record<Step, { title: string; description: string }> = {
    details: {
      title: "Connect AWS Account",
      description: "Enter your AWS account details to get started",
    },
    policy: {
      title: "Create IAM Role",
      description: "Set up a read-only IAM role for ScanOrbit to scan your infrastructure",
    },
    connect: {
      title: "Connect Role",
      description: "Enter the Role ARN and test the connection",
    },
  };

  const stepNumber = step === "details" ? 1 : step === "policy" ? 2 : 3;

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="mb-8 flex items-center justify-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
            <span className="text-lg font-bold text-primary-foreground">SO</span>
          </div>
          <span className="text-2xl font-bold">ScanOrbit</span>
        </div>

        {/* Progress indicator */}
        <div className="mb-6 flex items-center justify-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
            1
          </div>
          <div className="h-0.5 w-12 bg-primary" />
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
              stepNumber >= 2
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            2
          </div>
          <div className={`h-0.5 w-12 ${stepNumber >= 2 ? "bg-primary" : "bg-muted"}`} />
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
              stepNumber >= 3
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            3
          </div>
        </div>

        <Card>
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
                onSubmit={handleCreateAccount}
                isLoading={isCreating}
                error={error}
              />
            )}
            {step === "policy" && account && (
              <PolicyGuide
                awsAccountId={account.awsAccountId}
                onNext={() => setStep("connect")}
                onBack={() => setStep("details")}
              />
            )}
            {step === "connect" && account && (
              <TestConnection
                awsAccountId={account.awsAccountId}
                onTest={handleTestConnection}
                onSubmit={handleConnect}
                onBack={() => setStep("policy")}
                isLoading={isConnecting || triggerScan.isPending}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
