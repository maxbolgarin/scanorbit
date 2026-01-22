import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { AlertCircle } from "lucide-react";

const createAccountSchema = (existingNames: string[], existingAwsAccountIds: string[]) => z.object({
  name: z.string()
    .min(1, "Account name is required")
    .refine(
      (name) => !existingNames.some(existing => existing.toLowerCase() === name.toLowerCase()),
      "An account with this name already exists"
    ),
  awsAccountId: z
    .string()
    .regex(/^\d{12}$/, "AWS Account ID must be a 12-digit number")
    .refine(
      (id) => !existingAwsAccountIds.includes(id),
      "This AWS account is already connected to your organization"
    ),
});

type AccountFormData = z.infer<ReturnType<typeof createAccountSchema>>;

interface AwsAccountFormProps {
  onSubmit: (data: AccountFormData) => Promise<void>;
  onBack?: () => void;
  isLoading?: boolean;
  error?: string | null;
  existingNames?: string[];
  existingAwsAccountIds?: string[];
}

export function AwsAccountForm({
  onSubmit,
  onBack,
  isLoading,
  error,
  existingNames = [],
  existingAwsAccountIds = [],
}: AwsAccountFormProps) {
  const accountSchema = createAccountSchema(existingNames, existingAwsAccountIds);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AccountFormData>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      name: "",
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="name">Account Name</Label>
        <Input
          id="name"
          type="text"
          placeholder="Production"
          {...register("name")}
          disabled={isLoading}
        />
        {errors.name && (
          <p className="text-sm text-red-500">{errors.name.message}</p>
        )}
        <p className="text-xs text-muted-foreground">
          A friendly name to identify this AWS account
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="awsAccountId">AWS Account ID</Label>
        <Input
          id="awsAccountId"
          type="text"
          placeholder="123456789012"
          {...register("awsAccountId")}
          disabled={isLoading}
        />
        {errors.awsAccountId && (
          <p className="text-sm text-red-500">{errors.awsAccountId.message}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Your 12-digit AWS account number
        </p>
      </div>

      <div className="flex gap-3 pt-4">
        {onBack && (
          <Button type="button" variant="outline" onClick={onBack} disabled={isLoading}>
            Back
          </Button>
        )}
        <Button type="submit" className="flex-1" disabled={isLoading}>
          {isLoading ? (
            <>
              <LoadingSpinner size="sm" className="mr-2" />
              Creating...
            </>
          ) : (
            "Next"
          )}
        </Button>
      </div>
    </form>
  );
}
