import { useState, useRef, useEffect, KeyboardEvent, ClipboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { AlertCircle, ShieldCheck, ArrowLeft } from "lucide-react";
import { verifyCode, resendVerificationCode } from "@/lib/api";
import { cn } from "@/lib/utils";

interface CodeStepProps {
  email: string;
  onNext: (signupToken: string) => void;
  onBack: () => void;
}

export function CodeStep({ email, onNext, onBack }: CodeStepProps) {
  const [code, setCode] = useState<string[]>(["", "", "", "", "", ""]);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Countdown timer for resend
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Auto-submit when code is complete
  useEffect(() => {
    const fullCode = code.join("");
    if (fullCode.length === 6 && !code.includes("")) {
      handleSubmit();
    }
  }, [code]);

  const handleInputChange = (index: number, value: string) => {
    // Only allow digits
    const digit = value.replace(/\D/g, "").slice(-1);

    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);
    setError(null);

    // Move to next input
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowRight" && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pastedData) {
      const newCode = [...code];
      for (let i = 0; i < pastedData.length && i < 6; i++) {
        newCode[i] = pastedData[i];
      }
      setCode(newCode);
      // Focus last filled input or the next empty one
      const focusIndex = Math.min(pastedData.length, 5);
      inputRefs.current[focusIndex]?.focus();
    }
  };

  const handleSubmit = async () => {
    const fullCode = code.join("");
    if (fullCode.length !== 6) {
      setError("Please enter the complete 6-digit code");
      return;
    }

    setError(null);
    setIsLoading(true);
    try {
      const result = await verifyCode(email, fullCode);
      onNext(result.signupToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid verification code");
      // Clear code on error
      setCode(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;

    setIsResending(true);
    setError(null);
    try {
      await resendVerificationCode(email);
      setResendCooldown(60);
      setCode(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } catch (err) {
      // Extract wait time from error message if present
      const message = err instanceof Error ? err.message : "Failed to resend code";
      const waitMatch = message.match(/wait (\d+) seconds/);
      if (waitMatch) {
        setResendCooldown(parseInt(waitMatch[1], 10));
      }
      setError(message);
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <ShieldCheck className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-lg font-semibold">Verify your email</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Enter the 6-digit code sent to
        </p>
        <p className="text-sm font-medium text-foreground">{email}</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Code input boxes */}
      <div className="flex justify-center gap-2">
        {code.map((digit, index) => (
          <Input
            key={index}
            ref={(el) => {inputRefs.current[index] = el}}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleInputChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            disabled={isLoading}
            className={cn(
              "w-12 h-14 text-center text-xl font-semibold",
              "focus:ring-2 focus:ring-primary"
            )}
            autoFocus={index === 0}
          />
        ))}
      </div>

      <Button
        type="button"
        className="w-full"
        disabled={isLoading || code.includes("")}
        onClick={handleSubmit}
      >
        {isLoading ? (
          <>
            <LoadingSpinner size="sm" className="mr-2" />
            Verifying...
          </>
        ) : (
          "Verify Code"
        )}
      </Button>

      {/* Resend option */}
      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          Didn't receive the code?{" "}
          <button
            type="button"
            onClick={handleResend}
            disabled={resendCooldown > 0 || isResending}
            className={cn(
              "font-medium",
              resendCooldown > 0 || isResending
                ? "text-muted-foreground cursor-not-allowed"
                : "text-primary hover:underline"
            )}
          >
            {isResending ? (
              "Sending..."
            ) : resendCooldown > 0 ? (
              `Resend in ${resendCooldown}s`
            ) : (
              "Resend code"
            )}
          </button>
        </p>
      </div>

      {/* Back button */}
      <Button
        type="button"
        variant="ghost"
        className="w-full"
        onClick={onBack}
        disabled={isLoading}
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Use a different email
      </Button>
    </div>
  );
}
