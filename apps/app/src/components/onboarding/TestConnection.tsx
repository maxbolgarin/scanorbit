import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import type { TestConnectionResult } from "@/types";

const roleSchema = z.object({
  roleArn: z
    .string()
    .regex(
      /^arn:aws:iam::\d{12}:role\/.+$/,
      "Invalid Role ARN format. Example: arn:aws:iam::123456789012:role/ScanOrbitReadOnly"
    ),
});

type RoleFormData = z.infer<typeof roleSchema>;

interface TestConnectionProps {
  awsAccountId: string;
  onTest: (roleArn: string) => Promise<TestConnectionResult>;
  onSubmit: (roleArn: string) => Promise<void>;
  onBack: () => void;
  isLoading?: boolean;
}

export function TestConnection({
  awsAccountId,
  onTest,
  onSubmit,
  onBack,
  isLoading,
}: TestConnectionProps) {
  const [testResult, setTestResult] = useState<TestConnectionResult | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RoleFormData>({
    resolver: zodResolver(roleSchema),
    defaultValues: {
      roleArn: `arn:aws:iam::${awsAccountId}:role/ScanOrbitReadOnly`,
    },
  });

  const roleArn = watch("roleArn");

  const handleTest = async () => {
    if (!roleArn || errors.roleArn) return;

    setIsTesting(true);
    setTestResult(null);
    setError(null);

    try {
      const result = await onTest(roleArn);
      setTestResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test failed");
    } finally {
      setIsTesting(false);
    }
  };

  const handleFinish = async (data: RoleFormData) => {
    if (!testResult?.success) {
      setError("Please test the connection first");
      return;
    }
    await onSubmit(data.roleArn);
  };

  return (
    <form onSubmit={handleSubmit(handleFinish)} className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="roleArn">IAM Role ARN</Label>
        <Input
          id="roleArn"
          type="text"
          placeholder="arn:aws:iam::123456789012:role/ScanOrbitReadOnly"
          {...register("roleArn")}
          disabled={isLoading || isTesting}
        />
        {errors.roleArn && (
          <p className="text-sm text-red-500">{errors.roleArn.message}</p>
        )}
        <p className="text-xs text-muted-foreground">
          The ARN of the IAM role you created in the previous step
        </p>
      </div>

      <Button
        type="button"
        variant="secondary"
        className="w-full"
        onClick={handleTest}
        disabled={isLoading || isTesting || !roleArn || !!errors.roleArn}
      >
        {isTesting ? (
          <>
            <LoadingSpinner size="sm" className="mr-2" />
            Testing connection...
          </>
        ) : (
          "Test Connection"
        )}
      </Button>

      {testResult && (
        <div
          className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
            testResult.success
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-600"
          }`}
        >
          {testResult.success ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          )}
          <div>
            <p className="font-medium">
              {testResult.success
                ? testResult.message || "Connection successful! ScanOrbit can access your AWS account."
                : testResult.message || "Connection failed. Please check your role configuration."}
            </p>
            {testResult.regions && testResult.regions.length > 0 && (
              <p className="mt-1 text-xs">
                Regions available: {testResult.regions.join(", ")}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={isLoading}
        >
          Back
        </Button>
        <Button
          type="submit"
          className="flex-1"
          disabled={isLoading || !testResult?.success}
        >
          {isLoading ? (
            <>
              <LoadingSpinner size="sm" className="mr-2" />
              Connecting...
            </>
          ) : (
            "Finish & Start Scan"
          )}
        </Button>
      </div>
    </form>
  );
}
