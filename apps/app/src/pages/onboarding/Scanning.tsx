import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useScanStatus } from "@/hooks/use-aws-accounts";
import { useSubscriptionStatus } from "@/hooks/use-subscription";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { CheckCircle2, Radar, AlertCircle, Orbit, Sparkles, ArrowRight } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function Scanning() {
  const navigate = useNavigate();
  const { scanId } = useParams<{ scanId: string }>();
  const { data: scan, isLoading, error } = useScanStatus(scanId || null);
  const { status: subStatus } = useSubscriptionStatus();
  const [showTrialOffer, setShowTrialOffer] = useState(false);

  const canStartTrial =
    subStatus?.stripeEnabled &&
    subStatus?.subscriptionStatus === "none" &&
    subStatus?.tier === "free";

  const startCheckout = () => navigate("/checkout?plan=pro");

  useEffect(() => {
    if (scan?.status === "complete") {
      toast({
        title: "Scan complete!",
        description: `Discovered ${scan.resourcesDiscovered} resources.`,
        type: "success",
      });

      if (canStartTrial) {
        setShowTrialOffer(true);
      } else {
        // Wait a moment before redirecting
        const timeout = setTimeout(() => {
          navigate("/overview");
        }, 2000);
        return () => clearTimeout(timeout);
      }
    }
  }, [scan?.status, scan?.resourcesDiscovered, navigate, canStartTrial]);

  if (isLoading || !scan) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="py-8 text-center">
            <p className="text-red-500">Failed to load scan status</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isComplete = scan.status === "complete" || scan.status === "partial";
  const isError = scan.status === "error";
  const isActive = ["queued", "processing", "running", "analyzing"].includes(scan.status);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 flex items-center justify-center gap-3">
          <Orbit className="h-10 w-10 text-cyber-cyan" />
          <span className="text-3xl font-bold bg-gradient-to-r from-cyber-cyan to-orbit-purple bg-clip-text text-transparent">
            ScanOrbit
          </span>
        </div>

        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              {isComplete ? (
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              ) : isError ? (
                <AlertCircle className="h-8 w-8 text-red-500" />
              ) : (
                <Radar className="h-8 w-8 animate-pulse text-primary" />
              )}
            </div>
            <CardTitle>
              {isComplete
                ? "Scan Complete!"
                : isError
                ? "Scan Failed"
                : "Scanning your AWS account"}
            </CardTitle>
            <CardDescription>
              {isComplete
                ? showTrialOffer
                  ? "Your infrastructure has been analyzed!"
                  : "Redirecting to your dashboard..."
                : isError
                ? scan.errorMessage || "An error occurred during the scan"
                : "This usually takes 5-10 minutes"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {isActive && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <LoadingSpinner size="sm" />
                {scan.status === "queued" ? "Waiting in queue..." :
                 scan.status === "processing" ? "Initializing scan..." :
                 scan.status === "analyzing" ? "Analyzing findings..." :
                 "Scanning resources..."}
              </div>
            )}

            {isComplete && (
              <>
                <div className="rounded-lg border bg-muted/50 p-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold">{scan.resourcesDiscovered}</p>
                    <p className="text-sm text-muted-foreground">Resources Discovered</p>
                  </div>
                </div>

                {showTrialOffer && (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-center">
                    <Sparkles className="mx-auto h-6 w-6 text-primary mb-2" />
                    <p className="font-medium">Unlock Full Security Insights</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Start your 7-day free trial to access detailed findings, resource lists, and infrastructure maps.
                    </p>
                    <div className="mt-4 flex flex-col gap-2">
                      <Button onClick={startCheckout}>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Start 7-Day Free Trial
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate("/overview")}
                      >
                        Skip for now
                        <ArrowRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}

            {isError && (
              <div className="text-center">
                <button
                  onClick={() => navigate("/accounts")}
                  className="text-primary hover:underline"
                >
                  Go to AWS Accounts
                </button>
              </div>
            )}

            {!isComplete && !isError && (
              <div className="space-y-2 text-center text-sm text-muted-foreground">
                <p>Scanning services:</p>
                <p>EC2 • EBS • RDS • S3 • ALB • ACM</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
