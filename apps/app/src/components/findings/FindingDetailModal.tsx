import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SeverityBadge } from "@/components/shared/SeverityBadge";
import { FindingStatusBadge } from "@/components/shared/StatusBadge";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import type { Finding, FindingStatus } from "@/types";
import {
  ExternalLink,
  CheckCircle,
  Clock,
  EyeOff,
  AlertTriangle,
} from "lucide-react";

interface FindingDetailModalProps {
  finding: Finding | null;
  onClose: () => void;
  onUpdateStatus: (id: string, status: FindingStatus, snoozeDays?: number) => void;
  isUpdating?: boolean;
}

const typeLabels: Record<string, string> = {
  orphaned_volume: "Orphaned Volume",
  orphaned_eip: "Orphaned EIP",
  orphaned_snapshot: "Orphaned Snapshot",
  ssl_expiry: "SSL Certificate Expiry",
  data_residency_violation: "Data Residency Violation",
};

export function FindingDetailModal({
  finding,
  onClose,
  onUpdateStatus,
  isUpdating,
}: FindingDetailModalProps) {
  if (!finding) return null;

  const handleResolve = () => {
    onUpdateStatus(finding.id, "resolved");
  };

  const handleSnooze = (days: number) => {
    onUpdateStatus(finding.id, "snoozed", days);
  };

  const handleIgnore = () => {
    onUpdateStatus(finding.id, "ignored");
  };

  return (
    <Dialog open={!!finding} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <SeverityBadge severity={finding.severity} />
            <FindingStatusBadge status={finding.status} />
          </div>
          <DialogTitle className="text-xl">
            {typeLabels[finding.type] || finding.type}
          </DialogTitle>
          <DialogDescription>{finding.summary}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Description */}
          <div>
            <h4 className="mb-2 font-medium">Description</h4>
            <p className="text-sm text-muted-foreground">
              {finding.details.description}
            </p>
          </div>

          <Separator />

          {/* Recommendation */}
          <div>
            <h4 className="mb-2 flex items-center gap-2 font-medium">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              Recommendation
            </h4>
            <p className="text-sm text-muted-foreground">
              {finding.details.recommendation}
            </p>
          </div>

          <Separator />

          {/* Details */}
          <div className="grid gap-3 sm:grid-cols-2">
            {finding.details.region && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Region</p>
                <p className="mt-1">{finding.details.region}</p>
              </div>
            )}
            {finding.details.estimatedSavings && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Estimated Savings
                </p>
                <p className="mt-1 text-green-600 font-medium">
                  {formatCurrency(finding.details.estimatedSavings)}/month
                </p>
              </div>
            )}
            {finding.details.expiresAt && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Expires At
                </p>
                <p className="mt-1">{formatDateTime(finding.details.expiresAt)}</p>
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-muted-foreground">Detected</p>
              <p className="mt-1">{formatDateTime(finding.createdAt)}</p>
            </div>
            {finding.resolvedAt && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Resolved At
                </p>
                <p className="mt-1">{formatDateTime(finding.resolvedAt)}</p>
                {finding.resolvedBy && (
                  <p className="text-xs text-muted-foreground">
                    by {finding.resolvedBy}
                  </p>
                )}
              </div>
            )}
            {finding.snoozedUntil && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Snoozed Until
                </p>
                <p className="mt-1">{formatDateTime(finding.snoozedUntil)}</p>
              </div>
            )}
          </div>

          {finding.details.awsConsoleUrl && (
            <>
              <Separator />
              <Button variant="outline" asChild className="w-full">
                <a
                  href={finding.details.awsConsoleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open in AWS Console
                </a>
              </Button>
            </>
          )}
        </div>

        {finding.status === "open" && (
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => handleSnooze(7)}
              disabled={isUpdating}
            >
              <Clock className="mr-2 h-4 w-4" />
              Snooze 7 days
            </Button>
            <Button
              variant="outline"
              onClick={handleIgnore}
              disabled={isUpdating}
            >
              <EyeOff className="mr-2 h-4 w-4" />
              Ignore
            </Button>
            <Button onClick={handleResolve} disabled={isUpdating}>
              <CheckCircle className="mr-2 h-4 w-4" />
              Mark Resolved
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
