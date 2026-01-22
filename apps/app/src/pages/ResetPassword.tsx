import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { resetPassword } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
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
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { Orbit, AlertCircle, CheckCircle2, ArrowLeft, XCircle } from "lucide-react";

const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
  });

  // Check for missing token on mount
  useEffect(() => {
    if (!token) {
      setError("Invalid or missing reset link. Please request a new password reset.");
    }
  }, [token]);

  const onSubmit = async (data: ResetPasswordFormData) => {
    if (!token) {
      setError("Invalid or missing reset link. Please request a new password reset.");
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      await resetPassword(token, data.password);
      setIsSuccess(true);
      // Show success toast after a delay to allow the success state to render
      setTimeout(() => {
        toast({
          title: "Password reset successful",
          description: "You can now sign in with your new password.",
          type: "success",
        });
        navigate("/login", { replace: true });
      }, 2000);
    } catch (err) {
      console.error("Password reset error:", err);
      const message = err instanceof Error ? err.message : "Failed to reset password";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  // No token state
  if (!token && !isSuccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="mb-8 flex items-center justify-center gap-2">
            <Orbit className="h-10 w-10 text-cyber-cyan" />
            <span className="text-2xl font-bold bg-gradient-to-r from-orbit-purple to-cyber-cyan bg-clip-text text-transparent">
              ScanOrbit
            </span>
          </div>

          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                <XCircle className="h-6 w-6 text-destructive" />
              </div>
              <CardTitle>Invalid reset link</CardTitle>
              <CardDescription className="mt-2">
                This password reset link is invalid or has expired. Please request a new one.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/forgot-password">
                <Button className="w-full">Request new reset link</Button>
              </Link>
            </CardContent>
            <CardFooter className="flex justify-center">
              <Link
                to="/login"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to sign in
              </Link>
            </CardFooter>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 flex items-center justify-center gap-2">
          <Orbit className="h-10 w-10 text-cyber-cyan" />
          <span className="text-2xl font-bold bg-gradient-to-r from-orbit-purple to-cyber-cyan bg-clip-text text-transparent">
            ScanOrbit
          </span>
        </div>

        <Card>
          {isSuccess ? (
            <>
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                  <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <CardTitle>Password reset successful</CardTitle>
                <CardDescription className="mt-2">
                  Your password has been reset. Redirecting you to sign in...
                </CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center">
                <LoadingSpinner size="md" />
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader className="text-center">
                <CardTitle>Reset your password</CardTitle>
                <CardDescription>
                  Enter your new password below.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  {error && (
                    <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                      <AlertCircle className="h-4 w-4 flex-shrink-0" />
                      {error}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="password">New password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Enter new password"
                      autoComplete="new-password"
                      {...register("password")}
                      disabled={isLoading}
                    />
                    {errors.password && (
                      <p className="text-sm text-destructive">{errors.password.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="Confirm new password"
                      autoComplete="new-password"
                      {...register("confirmPassword")}
                      disabled={isLoading}
                    />
                    {errors.confirmPassword && (
                      <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
                    )}
                  </div>

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <LoadingSpinner size="sm" className="mr-2" />
                        Resetting password...
                      </>
                    ) : (
                      "Reset password"
                    )}
                  </Button>
                </form>
              </CardContent>
              <CardFooter className="flex justify-center">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to sign in
                </Link>
              </CardFooter>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
