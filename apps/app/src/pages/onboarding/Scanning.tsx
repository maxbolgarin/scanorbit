import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useScanStatus } from "@/hooks/use-aws-accounts";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { CheckCircle2, Radar, AlertCircle, Orbit } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function Scanning() {
  const navigate = useNavigate();
  const { scanId } = useParams<{ scanId: string }>();
  const { data: scan, isLoading, error } = useScanStatus(scanId || null);

  useEffect(() => {
    if (scan?.status === "complete") {
      toast({
        title: "Scan complete!",
        description: `Discovered ${scan.resourcesDiscovered} resources.`,
        type: "success",
      });
      // Wait a moment before redirecting
      const timeout = setTimeout(() => {
        navigate("/dashboard");
      }, 2000);
      return () => clearTimeout(timeout);
    }
  }, [scan?.status, scan?.resourcesDiscovered, navigate]);

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

  const isComplete = scan.status === "complete";
  const isError = scan.status === "error";
  const isRunning = scan.status === "running";
  const isPending = scan.status === "pending";

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
                ? "Redirecting to your dashboard..."
                : isError
                ? scan.errorMessage || "An error occurred during the scan"
                : "This usually takes 5-10 minutes"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {(isPending || isRunning) && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <LoadingSpinner size="sm" />
                {isPending ? "Initializing scan..." : "Scanning resources..."}
              </div>
            )}

            {isComplete && (
              <div className="rounded-lg border bg-muted/50 p-4">
                <div className="text-center">
                  <p className="text-2xl font-bold">{scan.resourcesDiscovered}</p>
                  <p className="text-sm text-muted-foreground">Resources Discovered</p>
                </div>
              </div>
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
