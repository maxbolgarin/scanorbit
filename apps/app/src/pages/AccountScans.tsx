import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useLocalStorage } from "@/hooks/use-local-storage";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { useAwsAccount, useScanHistory, useTriggerScan, useScanCompletionRefresh, useActiveScans } from "@/hooks/use-aws-accounts";
import { toast } from "@/hooks/use-toast";
import { formatDateTime, formatDuration } from "@/lib/utils";
import type { Scan, ScanStatus } from "@/types";
import { ACTIVE_SCAN_STATUSES } from "@/types";
import {
  History,
  CheckCircle2,
  Clock,
  XCircle,
  PlayCircle,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Loader2,
  Search,
  Ban,
  Scan as ScanIcon,
  Play,
  Cloud,
} from "lucide-react";

const statusConfig: Record<
  ScanStatus,
  { icon: React.ReactNode; label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  queued: {
    icon: <Clock className="h-4 w-4" />,
    label: "Queued",
    variant: "secondary",
  },
  processing: {
    icon: <Loader2 className="h-4 w-4 animate-spin" />,
    label: "Processing",
    variant: "secondary",
  },
  running: {
    icon: <PlayCircle className="h-4 w-4 animate-pulse" />,
    label: "Running",
    variant: "default",
  },
  analyzing: {
    icon: <Search className="h-4 w-4 animate-pulse" />,
    label: "Analyzing",
    variant: "default",
  },
  complete: {
    icon: <CheckCircle2 className="h-4 w-4" />,
    label: "Completed",
    variant: "outline",
  },
  partial: {
    icon: <AlertTriangle className="h-4 w-4" />,
    label: "Partial",
    variant: "outline",
  },
  error: {
    icon: <XCircle className="h-4 w-4" />,
    label: "Failed",
    variant: "destructive",
  },
  canceled: {
    icon: <Ban className="h-4 w-4" />,
    label: "Canceled",
    variant: "secondary",
  },
};

export default function AccountScans() {
  const { accountId } = useParams<{ accountId: string }>();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useLocalStorage<string>(`scans:statusFilter:${accountId}`, "all");
  const [showArchived, setShowArchived] = useLocalStorage<boolean>(`scans:showArchived:${accountId}`, false);
  const [showStartScanDialog, setShowStartScanDialog] = useState(false);

  // Fetch account-specific data
  const { data: account, isLoading: accountLoading } = useAwsAccount(accountId!);
  const { data: scans = [], isLoading, refetch } = useScanHistory(accountId!);
  const triggerScan = useTriggerScan();
  const { data: activeScansData } = useActiveScans();

  // Auto-refresh data when scans complete
  const { activeScans } = useScanCompletionRefresh();

  const getActiveScanForAccount = () =>
    activeScansData?.find((scan) => scan.awsAccountId === accountId);

  const getDuration = (scan: Scan) => {
    if (!scan.startedAt) return null;
    const start = new Date(scan.startedAt).getTime();
    const end = scan.completedAt
      ? new Date(scan.completedAt).getTime()
      : Date.now();
    return formatDuration(end - start);
  };

  const filteredScans = scans.filter((scan) => {
    if (!showArchived && !scan.hasKey) return false;
    if (statusFilter !== "all" && scan.status !== statusFilter) return false;
    return true;
  });

  const handleStartScan = async () => {
    if (!accountId) return;

    try {
      await triggerScan.mutateAsync(accountId);
      toast({
        title: "Scan started",
        description: `Started scanning ${account?.name || "account"}.`,
        type: "success",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start scan. Please try again.";
      toast({
        title: "Scan failed",
        description: message,
        type: "error",
      });
    }
  };

  const hasScanInProgress = (activeScans && activeScans.some(s => s.awsAccountId === accountId)) ||
    scans.some(scan => ACTIVE_SCAN_STATUSES.includes(scan.status));

  if (isLoading || accountLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <Cloud className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Scans</h1>
            <p className="text-muted-foreground">
              {account?.name || "Loading..."} &bull; {account?.awsAccountId}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Start Scan panel */}
      {account?.status === "ok" && (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Play className="h-5 w-5 text-primary" />
              Start Scan
            </CardTitle>
            <CardDescription>
              Scan this AWS account to discover resources and identify issues
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Button
                onClick={() => setShowStartScanDialog(true)}
                disabled={triggerScan.isPending || !!getActiveScanForAccount()}
              >
                {triggerScan.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Start Scan
                  </>
                )}
              </Button>
              {getActiveScanForAccount() && (
                <p className="text-sm text-muted-foreground">
                  <Loader2 className="h-3 w-3 inline mr-1 animate-spin" />
                  Scan in progress ({getActiveScanForAccount()?.status})
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Account error state */}
      {account?.status === "error" && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="flex items-start gap-4 py-4">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium text-destructive">Connection Error</h4>
              <p className="text-sm text-muted-foreground mt-1">
                {account.lastError || "Unable to connect to this AWS account."}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => navigate("/accounts")}
              >
                Manage Account
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scan history card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <History className="h-5 w-5 text-muted-foreground" />
                Scan History
              </CardTitle>
              <CardDescription>
                {scans.length === 0
                  ? "No scans have been run yet"
                  : `${filteredScans.length} scan${filteredScans.length !== 1 ? "s" : ""} found`}
              </CardDescription>
            </div>
            {scans.length > 0 && (
              <div className="flex items-center gap-3">
                <Checkbox
                  id="show-archived"
                  checked={showArchived}
                  onChange={(e) => setShowArchived(e.target.checked)}
                  label="Show archived"
                />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="queued">Queued</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="running">Running</SelectItem>
                    <SelectItem value="analyzing">Analyzing</SelectItem>
                    <SelectItem value="complete">Completed</SelectItem>
                    <SelectItem value="partial">Partial</SelectItem>
                    <SelectItem value="error">Failed</SelectItem>
                    <SelectItem value="canceled">Canceled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {scans.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-primary/10 p-4">
                <ScanIcon className="h-8 w-8 text-primary" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">No scans yet</h3>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                Start a scan to discover resources and identify issues in this account.
              </p>
              {account?.status === "ok" && (
                <Button
                  className="mt-6"
                  onClick={() => setShowStartScanDialog(true)}
                  disabled={triggerScan.isPending || hasScanInProgress}
                >
                  <Play className="mr-2 h-4 w-4" />
                  Start First Scan
                </Button>
              )}
            </div>
          ) : filteredScans.length === 0 ? (
            <EmptyState
              icon={History}
              title="No scans match filters"
              description="Try adjusting your filters to see more results"
            />
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead className="text-right">Resources</TableHead>
                    <TableHead className="text-right">Changes</TableHead>
                    <TableHead className="text-right">Findings</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredScans.map((scan) => {
                    const config = statusConfig[scan.status] || {
                      icon: <Clock className="h-4 w-4" />,
                      label: scan.status || "Unknown",
                      variant: "secondary" as const,
                    };
                    const duration = getDuration(scan);

                    return (
                      <TableRow key={scan.id}>
                        <TableCell>
                          <Badge
                            variant={config.variant}
                            className={`flex items-center gap-1.5 w-fit ${!scan.hasKey ? "opacity-60" : ""}`}
                          >
                            <span className={
                              scan.status === "error" ? "text-destructive" :
                              scan.status === "complete" ? "text-green-500" :
                              scan.status === "partial" ? "text-orange-500" :
                              scan.status === "running" || scan.status === "analyzing" ? "text-primary" :
                              scan.status === "canceled" ? "text-muted-foreground" :
                              "text-yellow-500"
                            }>
                              {config.icon}
                            </span>
                            {config.label}
                          </Badge>
                          {!scan.hasKey && (
                            <span className="ml-1 text-xs text-muted-foreground">(archived)</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {scan.startedAt ? formatDateTime(scan.startedAt) : "-"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {scan.completedAt ? formatDateTime(scan.completedAt) : "-"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {duration || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {(scan.status === "complete" || scan.status === "partial") ? (
                            <span className="font-medium">{scan.resourcesDiscovered}</span>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {(scan.status === "complete" || scan.status === "partial") && scan.resourcesDelta !== 0 ? (
                            <Badge
                              variant="outline"
                              className={`text-xs ${scan.resourcesDelta > 0 ? "text-green-600 border-green-600" : "text-orange-600 border-orange-600"}`}
                            >
                              {scan.resourcesDelta > 0 ? (
                                <TrendingUp className="h-3 w-3 mr-1" />
                              ) : (
                                <TrendingDown className="h-3 w-3 mr-1" />
                              )}
                              {scan.resourcesDelta > 0 ? "+" : ""}{scan.resourcesDelta}
                            </Badge>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {(scan.status === "complete" || scan.status === "partial") && scan.findingsNew > 0 && (
                              <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-600">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                +{scan.findingsNew}
                              </Badge>
                            )}
                            {(scan.status === "complete" || scan.status === "partial") && scan.findingsResolved > 0 && (
                              <Badge variant="outline" className="text-xs text-green-600 border-green-600">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                -{scan.findingsResolved}
                              </Badge>
                            )}
                            {(scan.status === "complete" || scan.status === "partial") && scan.findingsNew === 0 && scan.findingsResolved === 0 && (
                              <span className="text-muted-foreground">-</span>
                            )}
                            {scan.status !== "complete" && scan.status !== "partial" && (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          {scan.errorMessage ? (
                            <div className="flex items-start gap-1.5 text-xs text-destructive">
                              <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                              <span className="truncate" title={scan.errorMessage}>
                                {scan.errorMessage}
                              </span>
                            </div>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Start Scan confirmation dialog */}
      <Dialog open={showStartScanDialog} onOpenChange={setShowStartScanDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Scan</DialogTitle>
            <DialogDescription>
              Are you sure you want to scan{" "}
              <span className="font-medium text-foreground">
                {account?.name || "this account"}
              </span>
              ? This will scan all resources in the AWS account and may take a few minutes.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStartScanDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setShowStartScanDialog(false);
                handleStartScan();
              }}
              disabled={triggerScan.isPending}
            >
              <Play className="mr-2 h-4 w-4" />
              Start Scan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
