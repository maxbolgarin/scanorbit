import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { AlertCircle, CheckCircle2, Copy, Download, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import * as api from "@/lib/api";

type SetupStep = "init" | "verify" | "recovery";

const verifySchema = z.object({
  code: z.string().length(6, "Code must be 6 digits").regex(/^\d+$/, "Code must contain only numbers"),
});

type VerifyFormData = z.infer<typeof verifySchema>;

interface TwoFactorSetupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function TwoFactorSetup({ open, onOpenChange, onSuccess }: TwoFactorSetupProps) {
  const [step, setStep] = useState<SetupStep>("init");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qrCodeUri, setQrCodeUri] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<VerifyFormData>({
    resolver: zodResolver(verifySchema),
  });

  const handleInitSetup = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.init2FASetup();
      setQrCodeUri(result.qrCodeUri);
      setSecret(result.secret);
      setStep("verify");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to initialize 2FA setup");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async (data: VerifyFormData) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.verify2FASetup(data.code);
      setRecoveryCodes(result.recoveryCodes);
      setStep("recovery");
      toast({
        title: "2FA Enabled",
        description: "Two-factor authentication has been enabled for your account.",
        type: "success",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to verify code");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (step === "recovery") {
      // User has completed setup
      onSuccess?.();
    }
    // Reset state
    setStep("init");
    setQrCodeUri(null);
    setSecret(null);
    setRecoveryCodes([]);
    setError(null);
    setShowSecret(false);
    reset();
    onOpenChange(false);
  };

  const copySecret = () => {
    if (secret) {
      navigator.clipboard.writeText(secret);
      toast({
        title: "Copied",
        description: "Secret key copied to clipboard",
      });
    }
  };

  const copyRecoveryCodes = () => {
    const codesText = recoveryCodes.join("\n");
    navigator.clipboard.writeText(codesText);
    toast({
      title: "Copied",
      description: "Recovery codes copied to clipboard",
    });
  };

  const downloadRecoveryCodes = () => {
    const codesText = `ScanOrbit Recovery Codes\n${"=".repeat(30)}\n\nKeep these codes safe. Each code can only be used once.\n\n${recoveryCodes.join("\n")}\n\nGenerated: ${new Date().toISOString()}`;
    const blob = new Blob([codesText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "scanorbit-recovery-codes.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({
      title: "Downloaded",
      description: "Recovery codes saved to file",
    });
  };

  return (
    <Dialog open={open} onOpenChange={step === "recovery" ? handleClose : onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            {step === "init" && "Enable Two-Factor Authentication"}
            {step === "verify" && "Scan QR Code"}
            {step === "recovery" && "Save Recovery Codes"}
          </DialogTitle>
          <DialogDescription>
            {step === "init" && "Add an extra layer of security to your account using an authenticator app."}
            {step === "verify" && "Scan this QR code with your authenticator app, then enter the code below."}
            {step === "recovery" && "Save these recovery codes in a safe place. You can use them to access your account if you lose your authenticator."}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {step === "init" && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/50 p-4 text-sm">
              <p className="font-medium mb-2">You'll need:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>An authenticator app (Google Authenticator, Authy, 1Password, etc.)</li>
                <li>Access to your phone or device with the app installed</li>
              </ul>
            </div>
            <Button onClick={handleInitSetup} disabled={isLoading} className="w-full">
              {isLoading ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  Setting up...
                </>
              ) : (
                "Get Started"
              )}
            </Button>
          </div>
        )}

        {step === "verify" && qrCodeUri && secret && (
          <div className="space-y-4">
            {/* QR Code */}
            <div className="flex justify-center p-4 bg-white rounded-lg">
              <QRCodeSVG value={qrCodeUri} size={180} />
            </div>

            {/* Manual Entry Secret */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Can't scan? Enter this code manually:</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded border bg-muted px-3 py-2 font-mono text-sm">
                  {showSecret ? secret : "••••••••••••••••••••••••••••••••"}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowSecret(!showSecret)}
                  title={showSecret ? "Hide secret" : "Show secret"}
                >
                  {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button variant="ghost" size="icon" onClick={copySecret} title="Copy secret">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Verification Code Input */}
            <form onSubmit={handleSubmit(handleVerify)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Enter the 6-digit code from your app</Label>
                <Input
                  id="code"
                  placeholder="000000"
                  maxLength={6}
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  {...register("code")}
                  disabled={isLoading}
                  className="text-center text-2xl tracking-widest font-mono"
                />
                {errors.code && (
                  <p className="text-sm text-destructive">{errors.code.message}</p>
                )}
              </div>
              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" />
                    Verifying...
                  </>
                ) : (
                  "Verify & Enable 2FA"
                )}
              </Button>
            </form>
          </div>
        )}

        {step === "recovery" && recoveryCodes.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-lg border border-success/50 bg-success/10 p-3 text-sm text-success">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              Two-factor authentication is now enabled!
            </div>

            <div className="rounded-lg border bg-muted/50 p-4">
              <p className="text-sm font-medium mb-3">Recovery Codes</p>
              <div className="grid grid-cols-2 gap-2">
                {recoveryCodes.map((code, index) => (
                  <code key={index} className="rounded border bg-background px-2 py-1 text-sm font-mono text-center">
                    {code}
                  </code>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={copyRecoveryCodes} className="flex-1">
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </Button>
              <Button variant="outline" onClick={downloadRecoveryCodes} className="flex-1">
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>

            <div className="rounded-lg border border-warning/50 bg-warning/10 p-3 text-sm text-warning">
              <p className="font-medium mb-1">Important:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Each code can only be used once</li>
                <li>Store them somewhere safe and secure</li>
                <li>You won't be able to see these codes again</li>
              </ul>
            </div>

            <Button onClick={handleClose} className="w-full">
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
