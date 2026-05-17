import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { TwoFactorSetup } from "./TwoFactorSetup";
import { Shield, Smartphone, Key, AlertCircle, CheckCircle2, Check, X, Pencil } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import * as api from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { cn } from "@/lib/utils";

const disableSchema = z.object({
  password: z.string().min(1, "Password is required"),
  code: z.string().length(6, "Code must be 6 digits").regex(/^\d+$/, "Code must contain only numbers"),
});

// Single password schema with optional currentPassword
// Validation for currentPassword is done conditionally in the submit handler
const passwordSchema = z
  .object({
    currentPassword: z.string().optional(),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[a-z]/, "Password must contain a lowercase letter")
      .regex(/[A-Z]/, "Password must contain an uppercase letter")
      .regex(/[0-9]/, "Password must contain a number"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type DisableFormData = z.infer<typeof disableSchema>;
type PasswordFormData = z.infer<typeof passwordSchema>;

export function SecuritySettings() {
  const user = useAuthStore((state) => state.user);
  const refreshAuth = useAuthStore((state) => state.refreshAuth);
  const hasPassword = user?.hasPassword ?? true; // Default to true for safety

  const [twoFactorStatus, setTwoFactorStatus] = useState<api.TwoFactorStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showSetupDialog, setShowSetupDialog] = useState(false);
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const [isDisabling, setIsDisabling] = useState(false);
  const [disableError, setDisableError] = useState<string | null>(null);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [isEditingPassword, setIsEditingPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset: resetDisableForm,
  } = useForm<DisableFormData>({
    resolver: zodResolver(disableSchema),
  });

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  });

  const newPassword = passwordForm.watch("newPassword", "");

  const passwordRequirements = [
    { label: "At least 8 characters", met: newPassword.length >= 8 },
    { label: "Contains lowercase letter", met: /[a-z]/.test(newPassword) },
    { label: "Contains uppercase letter", met: /[A-Z]/.test(newPassword) },
    { label: "Contains number", met: /[0-9]/.test(newPassword) },
  ];

  const fetchStatus = async () => {
    try {
      const status = await api.get2FAStatus();
      setTwoFactorStatus(status);
    } catch (error) {
      console.error("Failed to fetch 2FA status:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleSetupSuccess = () => {
    fetchStatus();
  };

  const handleDisable = async (data: DisableFormData) => {
    setIsDisabling(true);
    setDisableError(null);
    try {
      await api.disable2FA(data.password, data.code);
      setTwoFactorStatus({ enabled: false, recoveryCodesRemaining: 0 });
      setShowDisableDialog(false);
      resetDisableForm();
      toast({
        title: "2FA Disabled",
        description: "Two-factor authentication has been disabled for your account.",
        type: "success",
      });
    } catch (err) {
      setDisableError(err instanceof Error ? err.message : "Failed to disable 2FA");
    } finally {
      setIsDisabling(false);
    }
  };

  const closeDisableDialog = () => {
    setShowDisableDialog(false);
    setDisableError(null);
    resetDisableForm();
  };

  const handlePasswordSubmit = async (data: PasswordFormData) => {
    // Validate current password is provided when user has a password
    if (hasPassword && (!data.currentPassword || data.currentPassword.length < 8)) {
      passwordForm.setError("currentPassword", {
        type: "manual",
        message: "Password must be at least 8 characters",
      });
      return;
    }

    setIsUpdatingPassword(true);
    try {
      if (hasPassword) {
        await api.changePassword(data.currentPassword!, data.newPassword);
      } else {
        await api.setPassword(data.newPassword);
      }
      toast({
        title: hasPassword ? "Password changed" : "Password set",
        description: hasPassword
          ? "Your password has been changed successfully."
          : "Your password has been set successfully. You can now sign in with email and password.",
        type: "success",
      });
      passwordForm.reset();
      setIsEditingPassword(false);
      // Refresh user data to update hasPassword state
      await refreshAuth();
    } catch (err) {
      toast({
        title: "Update failed",
        description: err instanceof Error ? err.message : "Failed to update password",
        type: "error",
      });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 2FA Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Two-Factor Authentication
          </CardTitle>
          <CardDescription>
            Add an extra layer of security to your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <LoadingSpinner />
            </div>
          ) : twoFactorStatus?.enabled ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="font-medium">2FA is enabled</p>
                    <p className="text-sm text-muted-foreground">
                      {twoFactorStatus.recoveryCodesRemaining} recovery codes remaining
                    </p>
                  </div>
                </div>
                <Badge variant="success">Active</Badge>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDisableDialog(true)}
                >
                  Disable 2FA
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="font-medium">2FA Status</p>
                <p className="text-sm text-muted-foreground">
                  Protect your account with two-factor authentication
                </p>
              </div>
              <Button onClick={() => setShowSetupDialog(true)}>
                Enable 2FA
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Change/Set Password */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              {hasPassword ? "Change Password" : "Set Password"}
            </CardTitle>
            <CardDescription>
              {hasPassword
                ? "Update your password"
                : "Add a password to enable email/password login"}
            </CardDescription>
          </div>
          {!isEditingPassword && (
            <Button variant="outline" size="sm" onClick={() => setIsEditingPassword(true)} className="gap-2">
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <form
            onSubmit={passwordForm.handleSubmit(handlePasswordSubmit)}
            className="space-y-4"
          >
            {hasPassword && (
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  {...passwordForm.register("currentPassword")}
                  disabled={!isEditingPassword || isUpdatingPassword}
                />
                {passwordForm.formState.errors.currentPassword && (
                  <p className="text-sm text-red-500">
                    {passwordForm.formState.errors.currentPassword.message}
                  </p>
                )}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="newPassword">
                {hasPassword ? "New Password" : "Password"}
              </Label>
              <Input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                {...passwordForm.register("newPassword")}
                disabled={!isEditingPassword || isUpdatingPassword}
              />
              {newPassword && isEditingPassword && (
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
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                {...passwordForm.register("confirmPassword")}
                disabled={!isEditingPassword || isUpdatingPassword}
              />
              {passwordForm.formState.errors.confirmPassword && (
                <p className="text-sm text-red-500">
                  {passwordForm.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>
            {isEditingPassword && (
              <div className="flex gap-2">
                <Button type="submit" disabled={isUpdatingPassword}>
                  {isUpdatingPassword && (
                    <LoadingSpinner size="sm" className="mr-2" />
                  )}
                  {hasPassword ? "Change Password" : "Set Password"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    passwordForm.reset();
                    setIsEditingPassword(false);
                  }}
                  disabled={isUpdatingPassword}
                >
                  Cancel
                </Button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Security Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Overview
          </CardTitle>
          <CardDescription>Your account security status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="h-4 w-4 text-muted-foreground" />
                <span>Password</span>
              </div>
              {hasPassword ? (
                <Badge variant="success">Set</Badge>
              ) : (
                <Badge variant="secondary">Not set</Badge>
              )}
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-muted-foreground" />
                <span>Two-factor authentication</span>
              </div>
              {isLoading ? (
                <LoadingSpinner size="sm" />
              ) : twoFactorStatus?.enabled ? (
                <Badge variant="success">Enabled</Badge>
              ) : (
                <Badge variant="secondary">Not enabled</Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2FA Setup Dialog */}
      <TwoFactorSetup
        open={showSetupDialog}
        onOpenChange={setShowSetupDialog}
        onSuccess={handleSetupSuccess}
      />

      {/* Disable 2FA Dialog */}
      <Dialog open={showDisableDialog} onOpenChange={closeDisableDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Disable Two-Factor Authentication</DialogTitle>
            <DialogDescription>
              Enter your password and a verification code from your authenticator app to disable 2FA.
            </DialogDescription>
          </DialogHeader>

          {disableError && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {disableError}
            </div>
          )}

          <form onSubmit={handleSubmit(handleDisable)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="disable-password">Password</Label>
              <Input
                id="disable-password"
                type="password"
                placeholder="Enter your password"
                {...register("password")}
                disabled={isDisabling}
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="disable-code">Verification Code</Label>
              <Input
                id="disable-code"
                placeholder="000000"
                maxLength={6}
                autoComplete="one-time-code"
                inputMode="numeric"
                {...register("code")}
                disabled={isDisabling}
                className="text-center text-lg tracking-widest font-mono"
              />
              {errors.code && (
                <p className="text-sm text-destructive">{errors.code.message}</p>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDisableDialog}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={isDisabling}>
                {isDisabling ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" />
                    Disabling...
                  </>
                ) : (
                  "Disable 2FA"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
