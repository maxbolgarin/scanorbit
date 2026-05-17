import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Scan, RefreshCw, ArrowRight, Play } from "lucide-react";

interface NoScanStateProps {
  accountId: string;
  title?: string;
  description?: string;
  isScanning?: boolean;
  onTriggerScan?: () => void;
  isTriggeringScan?: boolean;
}

/**
 * State shown when no completed scan exists yet.
 * Directs user to Scans page to start a scan instead of having inline scan button.
 */
export function NoScanState({
  accountId,
  title = "Run a scan to see data",
  description = "Start a scan on the Scans page to discover resources and identify issues in this account.",
  isScanning = false,
  onTriggerScan,
  isTriggeringScan = false,
}: NoScanStateProps) {
  const navigate = useNavigate();

  if (isScanning) {
    return (
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-primary/20 p-5">
            <RefreshCw className="h-10 w-10 text-primary animate-spin" />
          </div>
          <h3 className="mt-6 text-xl font-semibold">Scanning your infrastructure...</h3>
          <p className="mt-3 max-w-lg text-muted-foreground">
            This account is being scanned. Data will appear here once the scan completes.
          </p>
          <Button
            variant="outline"
            size="lg"
            className="mt-8"
            onClick={() => navigate(`/accounts/${accountId}/scans`)}
          >
            View Scan Progress
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <div className="rounded-full bg-primary/20 p-5">
          <Scan className="h-10 w-10 text-primary" />
        </div>
        <h3 className="mt-6 text-xl font-semibold">{title}</h3>
        <p className="mt-3 max-w-lg text-muted-foreground">
          {description}
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          {onTriggerScan ? (
            <Button
              size="lg"
              onClick={onTriggerScan}
              disabled={isTriggeringScan}
            >
              <Play className="mr-2 h-5 w-5" />
              {isTriggeringScan ? "Starting..." : "Start Scan"}
            </Button>
          ) : (
            <Button
              size="lg"
              onClick={() => navigate(`/accounts/${accountId}/scans`)}
            >
              Go to Scans
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
