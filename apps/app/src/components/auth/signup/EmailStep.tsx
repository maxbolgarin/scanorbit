import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { AlertCircle } from "lucide-react";
import { sendVerificationCode } from "@/lib/api";

const emailSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  consent: z.boolean().refine((val) => val === true, {
    message: "You must agree to the Terms of Service and Privacy Policy",
  }),
});

type EmailFormData = z.infer<typeof emailSchema>;

interface EmailStepProps {
  onNext: (email: string, consent: boolean) => void;
  initialEmail?: string;
  initialConsent?: boolean;
}

export function EmailStep({ onNext, initialEmail = "", initialConsent = false }: EmailStepProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: initialEmail, consent: initialConsent },
  });

  const consent = watch("consent");

  const onSubmit = async (data: EmailFormData) => {
    setError(null);
    setIsLoading(true);
    try {
      await sendVerificationCode(data.email);
      onNext(data.email, data.consent);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send verification code");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="email">Email address</Label>
        <Input
          id="email"
          type="email"
          placeholder="you@company.com"
          autoFocus
          {...register("email")}
          disabled={isLoading}
        />
        {errors.email && (
          <p className="text-sm text-destructive">{errors.email.message}</p>
        )}
      </div>

      <div className="pt-2">
        <Checkbox
          id="consent"
          checked={consent}
          onChange={(e) => setValue("consent", e.target.checked, { shouldValidate: true })}
          disabled={isLoading}
          label={
            <span className="text-sm text-muted-foreground">
              I agree to the{" "}
              <a
                href="/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Terms of Service
              </a>{" "}
              and{" "}
              <a
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Privacy Policy
              </a>
            </span>
          }
        />
        {errors.consent && (
          <p className="text-sm text-destructive mt-1">{errors.consent.message}</p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={isLoading || !consent}>
        {isLoading ? (
          <>
            <LoadingSpinner size="sm" className="mr-2" />
            Sending code...
          </>
        ) : (
          "Continue"
        )}
      </Button>
    </form>
  );
}
