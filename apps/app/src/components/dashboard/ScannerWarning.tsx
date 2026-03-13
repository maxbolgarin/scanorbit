import { Link } from "react-router-dom";
import { AlertTriangle, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AwsAccount } from "@/types";

const TOTAL_SCANNERS = 11;

interface ScannerWarningProps {
  accounts: AwsAccount[];
}

export function ScannerWarning({ accounts }: ScannerWarningProps) {
  // Find accounts with limited scanner configurations
  const accountsWithLimitedScanners = accounts.filter((account) => {
    const scannerCount = account.enabledScanners?.length ?? TOTAL_SCANNERS;
    return scannerCount > 0 && scannerCount < TOTAL_SCANNERS;
  });

  // Don't show anything if all accounts have all scanners enabled
  if (accountsWithLimitedScanners.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-status-warning/50 bg-status-warning/15 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-status-warning mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-status-warning">Limited Scanner Configuration</h4>
          <p className="text-sm text-muted-foreground mt-1">
            {accountsWithLimitedScanners.length === 1
              ? "One AWS account has"
              : `${accountsWithLimitedScanners.length} AWS accounts have`}{" "}
            limited scanners enabled. Some resources may not be scanned.
          </p>

          <div className="mt-3 space-y-1.5">
            {accountsWithLimitedScanners.map((account) => (
              <div key={account.id} className="text-sm flex items-center gap-2">
                <span className="font-medium">{account.name}</span>
                <span className="text-muted-foreground">
                  ({account.enabledScanners?.length || 0} of {TOTAL_SCANNERS} scanners)
                </span>
              </div>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            asChild
          >
            <Link to="/settings?tab=aws">
              <Settings className="mr-2 h-4 w-4" />
              Configure Scanners
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
