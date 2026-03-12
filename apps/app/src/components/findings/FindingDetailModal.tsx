import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SeverityBadge } from "@/components/shared/SeverityBadge";
import { FindingStatusBadge } from "@/components/shared/StatusBadge";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { FINDING_REMEDIATIONS } from "@/lib/findingRemediations";
import type { Finding, FindingStatus } from "@/types";
import {
  ExternalLink,
  CheckCircle,
  Clock,
  EyeOff,
  AlertTriangle,
  History,
  RefreshCw,
  X,
  Undo2,
  Info,
  Ban,
  Wrench,
  ArrowRight,
} from "lucide-react";

interface FindingDetailModalProps {
  finding: Finding | null;
  onClose: () => void;
  onUpdateStatus: (id: string, status: FindingStatus, snoozedUntil?: Date) => void;
  isUpdating?: boolean;
  resourcePathPrefix?: string;
}

type ViewState =
  | "details"
  | "confirm-resolve"
  | "confirm-ignore"
  | "confirm-snooze"
  | "success";

const typeLabels: Record<string, string> = {
  // Orphan findings
  orphaned_volume: "Orphaned Volume",
  orphaned_eip: "Orphaned EIP",
  orphaned_snapshot: "Orphaned Snapshot",
  orphaned_eni: "Orphaned ENI",
  idle_load_balancer: "Idle Load Balancer",
  idle_nat_gateway: "Idle NAT Gateway",
  unused_security_group: "Unused Security Group",
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

const snoozeOptions = [
  { value: "1", label: "1 day" },
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
];

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
  resourcePathPrefix,
}: FindingDetailModalProps) {
  const navigate = useNavigate();
  const [viewState, setViewState] = useState<ViewState>("details");
  const [completedAction, setCompletedAction] = useState<FindingStatus | null>(null);
  const [snoozeDays, setSnoozeDays] = useState("7");
  const [snoozedUntilDate, setSnoozedUntilDate] = useState<Date | null>(null);

  // Reset modal state when a different finding is opened
  useEffect(() => {
    setViewState("details");
    setCompletedAction(null);
    setSnoozeDays("7");
    setSnoozedUntilDate(null);
  }, [finding?.id]);

  if (!finding) return null;

  const description = getDetailString(finding.details, "description");
  const recommendation = getDetailString(finding.details, "recommendation");
  const region = getDetailString(finding.details, "region");
  const estimatedSavings = getDetailNumber(finding.details, "estimatedSavings");
  const expiresAt = getDetailString(finding.details, "expiresAt");
  const awsConsoleUrl = getDetailString(finding.details, "awsConsoleUrl");
  const docUrl = getDetailString(finding.details, "doc_url");

  const handleClose = () => {
    setViewState("details");
    setCompletedAction(null);
    setSnoozeDays("7");
    setSnoozedUntilDate(null);
    onClose();
  };

  const handleResolve = () => {
    onUpdateStatus(finding.id, "resolved");
    setCompletedAction("resolved");
    setViewState("success");
  };

  const handleSnooze = () => {
    const days = parseInt(snoozeDays, 10);
    const snoozedUntil = new Date();
    snoozedUntil.setDate(snoozedUntil.getDate() + days);
    setSnoozedUntilDate(snoozedUntil);
    onUpdateStatus(finding.id, "snoozed", snoozedUntil);
    setCompletedAction("snoozed");
    setViewState("success");
  };

  const handleIgnore = () => {
    onUpdateStatus(finding.id, "ignored");
    setCompletedAction("ignored");
    setViewState("success");
  };

  const handleUndo = () => {
    onUpdateStatus(finding.id, "open");
    handleClose();
  };

  const handleBackToDetails = () => {
    setViewState("details");
  };

  // Render confirmation for Resolve
  const renderResolveConfirmation = () => (
    <div className="space-y-6">
      <div className="flex flex-col items-center text-center">
        <div className="mb-4 rounded-full bg-green-100 p-3 dark:bg-green-900/30">
          <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
        </div>
        <h3 className="text-lg font-semibold">Mark as Resolved?</h3>
        <p className="mt-2 text-sm text-muted-foreground max-w-md">
          This marks the finding as resolved. However, if this issue is detected
          again in your next scan, the finding will automatically reopen.
        </p>
      </div>

      <div className="rounded-lg border bg-muted/30 p-4">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-sm">When to use this</p>
            <p className="text-sm text-muted-foreground mt-1">
              Use this when you've fixed the underlying issue in AWS. If the problem
              is truly resolved, it won't appear in future scans.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border p-3 bg-card">
        <p className="text-sm font-medium text-muted-foreground">Finding</p>
        <p className="mt-1">{finding.summary}</p>
      </div>

      <DialogFooter className="flex-col gap-2 sm:flex-row">
        <Button variant="outline" onClick={handleBackToDetails} disabled={isUpdating}>
          Cancel
        </Button>
        <Button onClick={handleResolve} disabled={isUpdating} className="bg-green-600 hover:bg-green-700">
          <CheckCircle className="mr-2 h-4 w-4" />
          Mark Resolved
        </Button>
      </DialogFooter>
    </div>
  );

  // Render confirmation for Ignore
  const renderIgnoreConfirmation = () => (
    <div className="space-y-6">
      <div className="flex flex-col items-center text-center">
        <div className="mb-4 rounded-full bg-gray-100 p-3 dark:bg-gray-800">
          <EyeOff className="h-8 w-8 text-gray-600 dark:text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold">Ignore this Finding?</h3>
        <p className="mt-2 text-sm text-muted-foreground max-w-md">
          Ignored findings will <strong>NOT reopen</strong> even if detected in future scans.
          This is permanent until you manually change it.
        </p>
      </div>

      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-sm text-amber-500">Permanent action</p>
            <p className="text-sm text-muted-foreground mt-1">
              Future scans will skip this finding. You can reopen it manually at any time.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-muted/30 p-4">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-sm">Use this for</p>
            <ul className="text-sm text-muted-foreground mt-1 list-disc list-inside space-y-1">
              <li>False positives</li>
              <li>Accepted risks that don't need fixing</li>
              <li>Issues you've decided to accept</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="rounded-lg border p-3 bg-card">
        <div className="flex items-center gap-2 mb-1">
          <SeverityBadge severity={finding.severity} />
          <span className="text-sm font-medium text-muted-foreground">{typeLabels[finding.type] || finding.type}</span>
        </div>
        <p className="mt-1">{finding.summary}</p>
      </div>

      <DialogFooter className="flex-col gap-2 sm:flex-row">
        <Button variant="outline" onClick={handleBackToDetails} disabled={isUpdating}>
          Cancel
        </Button>
        <Button variant="secondary" onClick={handleIgnore} disabled={isUpdating}>
          <Ban className="mr-2 h-4 w-4" />
          Ignore Finding
        </Button>
      </DialogFooter>
    </div>
  );

  // Render confirmation for Snooze
  const renderSnoozeConfirmation = () => {
    const reopenDate = new Date(Date.now() + parseInt(snoozeDays) * 24 * 60 * 60 * 1000);

    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 rounded-full bg-amber-100 p-3 dark:bg-amber-900/30">
            <Clock className="h-8 w-8 text-amber-600 dark:text-amber-400" />
          </div>
          <h3 className="text-lg font-semibold">Snooze this Finding?</h3>
          <p className="mt-2 text-sm text-muted-foreground max-w-md">
            Snoozed findings are hidden until the snooze period ends.
            If still detected after that date, the finding will reopen.
          </p>
        </div>

        <div className="rounded-lg border p-4 space-y-4">
          <div>
            <label className="text-sm font-medium">Snooze for</label>
            <Select value={snoozeDays} onValueChange={setSnoozeDays}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {snoozeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-3 rounded-md bg-amber-500/10 p-3">
            <Clock className="h-5 w-5 text-amber-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium">Reopens on {reopenDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
              {(finding.detectionCount || 1) > 1 && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Detected {finding.detectionCount} times so far
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-lg border p-3 bg-card">
          <p className="text-sm font-medium text-muted-foreground">Finding</p>
          <p className="mt-1">{finding.summary}</p>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={handleBackToDetails} disabled={isUpdating}>
            Cancel
          </Button>
          <Button onClick={handleSnooze} disabled={isUpdating} className="bg-amber-600 hover:bg-amber-700">
            <Clock className="mr-2 h-4 w-4" />
            Snooze Finding
          </Button>
        </DialogFooter>
      </div>
    );
  };

  // Render success state
  const renderSuccessState = () => {
    const config = {
      resolved: {
        icon: CheckCircle,
        iconBg: "bg-green-100 dark:bg-green-900/30",
        iconColor: "text-green-600 dark:text-green-400",
        title: "Finding Resolved",
        description: `"${finding.summary}" has been marked as resolved.`,
        info: "If this issue appears in your next scan, the finding will automatically reopen so you can address it again.",
      },
      ignored: {
        icon: EyeOff,
        iconBg: "bg-gray-100 dark:bg-gray-800",
        iconColor: "text-gray-600 dark:text-gray-400",
        title: "Finding Ignored",
        description: `"${finding.summary}" has been ignored.`,
        info: "This finding will remain ignored even if detected in future scans. You can change this anytime from the finding details.",
      },
      snoozed: {
        icon: Clock,
        iconBg: "bg-amber-100 dark:bg-amber-900/30",
        iconColor: "text-amber-600 dark:text-amber-400",
        title: "Finding Snoozed",
        description: `"${finding.summary}" has been snoozed.`,
        info: `This finding is hidden until ${snoozedUntilDate?.toLocaleDateString() || "the snooze period ends"}. If still detected after that, it will reopen for your attention.`,
      },
    };

    const currentConfig = config[completedAction as keyof typeof config] || config.resolved;
    const IconComponent = currentConfig.icon;

    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center text-center">
          <div className={`mb-4 rounded-full ${currentConfig.iconBg} p-3`}>
            <IconComponent className={`h-8 w-8 ${currentConfig.iconColor}`} />
          </div>
          <h3 className="text-lg font-semibold">{currentConfig.title}</h3>
          <p className="mt-2 text-sm text-muted-foreground max-w-md">
            {currentConfig.description}
          </p>
        </div>

        <div className="rounded-lg border bg-muted/30 p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-sm">What happens next?</p>
              <p className="text-sm text-muted-foreground mt-1">
                {currentConfig.info}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={handleUndo} disabled={isUpdating}>
            <Undo2 className="mr-2 h-4 w-4" />
            Undo
          </Button>
          <Button onClick={handleClose}>
            <X className="mr-2 h-4 w-4" />
            Close
          </Button>
        </DialogFooter>
      </div>
    );
  };

  // Render the details view
  const renderDetails = () => (
    <>
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

        {description && <Separator />}

        {/* How to Fix — only shown for open findings */}
        {finding.status === "open" && (() => {
          const steps = FINDING_REMEDIATIONS[finding.type];
          const fallbackText = recommendation || getDetailString(finding.details, "action");

          if (!steps && !fallbackText) return null;

          return (
            <>
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-amber-500" />
                  <h4 className="font-medium">How to Fix</h4>
                  {docUrl && (
                    <a
                      href={docUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto flex items-center gap-1 text-xs text-blue-500 hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      AWS Docs
                    </a>
                  )}
                </div>
                {steps ? (
                  <ol className="list-decimal list-inside space-y-1.5 text-sm text-muted-foreground">
                    {steps.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-sm text-muted-foreground">{fallbackText}</p>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  {finding.resourceId && resourcePathPrefix && (
                    <Button
                      size="sm"
                      onClick={() => {
                        handleClose();
                        navigate(`${resourcePathPrefix}/resources/${finding.resourceId}`, {
                          state: { from: 'finding', findingId: finding.id },
                        });
                      }}
                    >
                      <ArrowRight className="mr-1.5 h-3.5 w-3.5" />
                      View Resource
                    </Button>
                  )}
                  {awsConsoleUrl && (
                    <Button size="sm" variant="outline" asChild>
                      <a href={awsConsoleUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                        Open in AWS Console
                      </a>
                    </Button>
                  )}
                </div>
              </div>
              <Separator />
            </>
          );
        })()}

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

      </div>

      {finding.status === "open" && (
        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={() => setViewState("confirm-snooze")}
            disabled={isUpdating}
          >
            <Clock className="mr-2 h-4 w-4" />
            Snooze
          </Button>
          <Button
            variant="outline"
            onClick={() => setViewState("confirm-ignore")}
            disabled={isUpdating}
          >
            <EyeOff className="mr-2 h-4 w-4" />
            Ignore
          </Button>
          <Button onClick={() => setViewState("confirm-resolve")} disabled={isUpdating}>
            <CheckCircle className="mr-2 h-4 w-4" />
            Resolve
          </Button>
        </DialogFooter>
      )}

      {finding.status !== "open" && (
        <DialogFooter>
          <Button variant="outline" onClick={() => handleUndo()} disabled={isUpdating}>
            <Undo2 className="mr-2 h-4 w-4" />
            Reopen Finding
          </Button>
          <Button onClick={handleClose}>
            Close
          </Button>
        </DialogFooter>
      )}
    </>
  );

  // Render content based on view state
  const renderContent = () => {
    switch (viewState) {
      case "confirm-resolve":
        return renderResolveConfirmation();
      case "confirm-ignore":
        return renderIgnoreConfirmation();
      case "confirm-snooze":
        return renderSnoozeConfirmation();
      case "success":
        return renderSuccessState();
      default:
        return renderDetails();
    }
  };

  return (
    <Dialog open={!!finding} onOpenChange={() => handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {renderContent()}
      </DialogContent>
    </Dialog>
  );
}
