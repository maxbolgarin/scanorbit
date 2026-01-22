import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { AlertCircle, Lock, Check, X, Eye, EyeOff } from "lucide-react";
import { completeSignup } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { cn } from "@/lib/utils";

const passwordSchema = z.object({
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[a-z]/, "Password must contain a lowercase letter")
    .regex(/[A-Z]/, "Password must contain an uppercase letter")
    .regex(/[0-9]/, "Password must contain a number"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type PasswordFormData = z.infer<typeof passwordSchema>;

interface PasswordStepProps {
  signupToken: string;
  email: string;
  consent: boolean;
  onNext: () => void;
  onTokenError?: () => void;
}

export function PasswordStep({ signupToken, email, consent, onNext, onTokenError }: PasswordStepProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { setUser, setToken } = useAuthStore();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  });

  const password = watch("password", "");

  const passwordRequirements = [
    { label: "At least 8 characters", met: password.length >= 8 },
    { label: "Contains lowercase letter", met: /[a-z]/.test(password) },
    { label: "Contains uppercase letter", met: /[A-Z]/.test(password) },
    { label: "Contains number", met: /[0-9]/.test(password) },
  ];

  const onSubmit = async (data: PasswordFormData) => {
    setError(null);
    setIsLoading(true);
    try {
      const result = await completeSignup(signupToken, data.password, consent);
      // Store user and token in auth store
      setUser({ ...result.user, emailVerified: true });
      setToken(result.token);
      onNext();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create account";
      setError(message);
      // Token-related errors require restarting the signup flow
      const isTokenError = message.toLowerCase().includes("token") ||
                           message.toLowerCase().includes("expired") ||
                           message.toLowerCase().includes("invalid");
      if (isTokenError && onTokenError) {
        onTokenError();
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="text-center mb-6">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Lock className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-lg font-semibold">Create your password</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Secure your account with a strong password
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="space-y-4">
        {/* Hidden email field for password manager autofill */}
        <input
          type="email"
          name="email"
          autoComplete="username email"
          value={email}
          readOnly
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
        />

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter password"
              autoComplete="new-password"
              autoFocus
              {...register("password")}
              disabled={isLoading}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {password && (
            <div className="mt-2 space-y-1">
              {passwordRequirements.map((req, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-center gap-2 text-xs",
                    req.met ? "text-green-500" : "text-muted-foreground"
                  )}
                >
                  {req.met ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <X className="h-3 w-3" />
                  )}
                  {req.label}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm-password">Confirm Password</Label>
          <div className="relative">
            <Input
              id="confirm-password"
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Confirm password"
              autoComplete="new-password"
              {...register("confirmPassword")}
              disabled={isLoading}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.confirmPassword && (
            <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
          )}
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? (
          <>
            <LoadingSpinner size="sm" className="mr-2" />
            Creating account...
          </>
        ) : (
          "Continue"
        )}
      </Button>

      <p className="text-xs text-center text-muted-foreground">
        Creating account for <span className="font-medium text-foreground">{email}</span>
      </p>
    </form>
  );
}
