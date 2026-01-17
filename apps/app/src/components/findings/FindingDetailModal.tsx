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
  History,
  RefreshCw,
} from "lucide-react";

interface FindingDetailModalProps {
  finding: Finding | null;
  onClose: () => void;
  onUpdateStatus: (id: string, status: FindingStatus, snoozedUntil?: Date) => void;
  isUpdating?: boolean;
}

const typeLabels: Record<string, string> = {
  // Orphan findings
  orphaned_volume: "Orphaned Volume",
  orphaned_eip: "Orphaned EIP",
  orphaned_snapshot: "Orphaned Snapshot",
  // SSL findings
  ssl_expiry: "SSL Certificate Expiry",
  // Compliance findings
  data_residency_violation: "Data Residency Violation",
  // Security findings
  unencrypted_resource: "Unencrypted Resource",
  public_access: "Public Access",
  permissive_security_group: "Permissive Security Group",
  open_all_ports: "Open All Ports",
  // Cost findings
  unused_resource: "Unused Resource",
  stopped_instance: "Stopped Instance",
  unused_log_group: "Unused Log Group",
  // Tagging findings
  missing_tag: "Missing Tag",
  // IAM findings
  old_access_key: "Old Access Key",
  unused_access_key: "Unused Access Key",
  unused_iam_role: "Unused IAM Role",
  user_without_mfa: "User Without MFA",
};

// Helper to safely get string from details
function getDetailString(details: Record<string, unknown>, key: string): string | null {
  const value = details[key];
  return typeof value === "string" ? value : null;
}

// Helper to safely get number from details
function getDetailNumber(details: Record<string, unknown>, key: string): number | null {
  const value = details[key];
  return typeof value === "number" ? value : null;
}

export function FindingDetailModal({
  finding,
  onClose,
  onUpdateStatus,
  isUpdating,
}: FindingDetailModalProps) {
  if (!finding) return null;

  const description = getDetailString(finding.details, "description");
  const recommendation = getDetailString(finding.details, "recommendation");
  const region = getDetailString(finding.details, "region");
  const estimatedSavings = getDetailNumber(finding.details, "estimatedSavings");
  const expiresAt = getDetailString(finding.details, "expiresAt");
  const awsConsoleUrl = getDetailString(finding.details, "awsConsoleUrl");

  const handleResolve = () => {
    onUpdateStatus(finding.id, "resolved");
  };

  const handleSnooze = (days: number) => {
    const snoozedUntil = new Date();
    snoozedUntil.setDate(snoozedUntil.getDate() + days);
    onUpdateStatus(finding.id, "snoozed", snoozedUntil);
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
          {description && (
            <div>
              <h4 className="mb-2 font-medium">Description</h4>
              <p className="text-sm text-muted-foreground">
                {description}
              </p>
            </div>
          )}

          {(description || recommendation) && <Separator />}

          {/* Recommendation */}
          {recommendation && (
            <div>
              <h4 className="mb-2 flex items-center gap-2 font-medium">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                Recommendation
              </h4>
              <p className="text-sm text-muted-foreground">
                {recommendation}
              </p>
            </div>
          )}

          {recommendation && <Separator />}

          {/* Detection Lifecycle */}
          <div className="rounded-lg border bg-muted/30 p-4">
            <h4 className="mb-3 flex items-center gap-2 font-medium">
              <History className="h-4 w-4 text-blue-500" />
              Detection History
            </h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-muted-foreground">First Detected</p>
                <p className="mt-1">{formatDateTime(finding.firstDetectedAt || finding.createdAt)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Last Detected</p>
                <p className="mt-1">{formatDateTime(finding.lastDetectedAt || finding.updatedAt)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <RefreshCw className="h-3 w-3" />
                  Detection Count
                </p>
                <p className="mt-1">
                  {finding.detectionCount || 1}
                  {(finding.detectionCount || 1) > 1 && (
                    <span className="ml-2 text-xs text-amber-600">Recurring issue</span>
                  )}
                </p>
              </div>
              {finding.resolvedAt && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Resolved At
                  </p>
                  <p className="mt-1">{formatDateTime(finding.resolvedAt)}</p>
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
          </div>

          <Separator />

          {/* Details */}
          <div className="grid gap-3 sm:grid-cols-2">
            {region && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Region</p>
                <p className="mt-1">{region}</p>
              </div>
            )}
            {estimatedSavings !== null && estimatedSavings > 0 && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Estimated Savings
                </p>
                <p className="mt-1 text-green-600 font-medium">
                  {formatCurrency(estimatedSavings)}/month
                </p>
              </div>
            )}
            {expiresAt && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Expires At
                </p>
                <p className="mt-1">{formatDateTime(expiresAt)}</p>
              </div>
            )}
          </div>

          {awsConsoleUrl && (
            <>
              <Separator />
              <Button variant="outline" asChild className="w-full">
                <a
                  href={awsConsoleUrl}
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
