import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuthStore } from "@/stores/auth-store";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { AlertCircle, ShieldCheck, KeyRound, ArrowLeft } from "lucide-react";

type ChallengeMode = "totp" | "recovery";

const totpSchema = z.object({
  code: z.string().length(6, "Code must be 6 digits").regex(/^\d+$/, "Code must contain only numbers"),
});

const recoverySchema = z.object({
  recoveryCode: z.string().min(1, "Recovery code is required"),
});

type TotpFormData = z.infer<typeof totpSchema>;
type RecoveryFormData = z.infer<typeof recoverySchema>;

interface TwoFactorChallengeProps {
  onBack: () => void;
  onSuccess: () => void;
}

export function TwoFactorChallenge({ onBack, onSuccess }: TwoFactorChallengeProps) {
  const { verify2FA, verify2FARecovery, isLoading, error, clearError } = useAuthStore();
  const [mode, setMode] = useState<ChallengeMode>("totp");
  const [localError, setLocalError] = useState<string | null>(null);

  const displayError = localError || error;

  const {
    register: registerTotp,
    handleSubmit: handleSubmitTotp,
    formState: { errors: totpErrors },
    reset: resetTotp,
  } = useForm<TotpFormData>({
    resolver: zodResolver(totpSchema),
  });

  const {
    register: registerRecovery,
    handleSubmit: handleSubmitRecovery,
    formState: { errors: recoveryErrors },
    reset: resetRecovery,
  } = useForm<RecoveryFormData>({
    resolver: zodResolver(recoverySchema),
  });

  const handleTotpSubmit = async (data: TotpFormData) => {
    setLocalError(null);
    clearError();
    try {
      await verify2FA(data.code);
      onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Verification failed";
      setLocalError(message);
    }
  };

  const handleRecoverySubmit = async (data: RecoveryFormData) => {
    setLocalError(null);
    clearError();
    try {
      await verify2FARecovery(data.recoveryCode);
      onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Recovery code verification failed";
      setLocalError(message);
    }
  };

  const switchMode = (newMode: ChallengeMode) => {
    setLocalError(null);
    clearError();
    setMode(newMode);
    if (newMode === "totp") {
      resetRecovery();
    } else {
      resetTotp();
    }
  };

  const handleBackClick = () => {
    setLocalError(null);
    clearError();
    onBack();
  };

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          {mode === "totp" ? (
            <ShieldCheck className="h-6 w-6 text-primary" />
          ) : (
            <KeyRound className="h-6 w-6 text-primary" />
          )}
        </div>
        <CardTitle>
          {mode === "totp" ? "Two-Factor Authentication" : "Use Recovery Code"}
        </CardTitle>
        <CardDescription>
          {mode === "totp"
            ? "Enter the 6-digit code from your authenticator app"
            : "Enter one of your recovery codes to access your account"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {displayError && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {displayError}
          </div>
        )}

        {mode === "totp" ? (
          <form onSubmit={handleSubmitTotp(handleTotpSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="totp-code">Verification Code</Label>
              <Input
                id="totp-code"
                placeholder="000000"
                maxLength={6}
                autoComplete="one-time-code"
                inputMode="numeric"
                autoFocus
                {...registerTotp("code")}
                disabled={isLoading}
                className="text-center text-2xl tracking-widest font-mono"
              />
              {totpErrors.code && (
                <p className="text-sm text-destructive">{totpErrors.code.message}</p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  Verifying...
                </>
              ) : (
                "Verify"
              )}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleSubmitRecovery(handleRecoverySubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="recovery-code">Recovery Code</Label>
              <Input
                id="recovery-code"
                placeholder="XXXX-XXXX"
                autoComplete="off"
                autoFocus
                {...registerRecovery("recoveryCode")}
                disabled={isLoading}
                className="text-center text-lg tracking-widest font-mono uppercase"
              />
              {recoveryErrors.recoveryCode && (
                <p className="text-sm text-destructive">{recoveryErrors.recoveryCode.message}</p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  Verifying...
                </>
              ) : (
                "Use Recovery Code"
              )}
            </Button>
          </form>
        )}
      </CardContent>
      <CardFooter className="flex flex-col gap-2">
        {mode === "totp" ? (
          <Button
            variant="link"
            className="text-sm"
            onClick={() => switchMode("recovery")}
            disabled={isLoading}
          >
            Lost access to your authenticator? Use a recovery code
          </Button>
        ) : (
          <Button
            variant="link"
            className="text-sm"
            onClick={() => switchMode("totp")}
            disabled={isLoading}
          >
            Back to authenticator code
          </Button>
        )}
        <Button
          variant="ghost"
          className="text-sm"
          onClick={handleBackClick}
          disabled={isLoading}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to login
        </Button>
      </CardFooter>
    </Card>
  );
}
