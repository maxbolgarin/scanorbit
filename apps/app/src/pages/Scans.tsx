import { useState } from "react";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useNavigate } from "react-router-dom";
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
import { useRecentScans, useAwsAccounts, useTriggerScan, useScanCompletionRefresh, useActiveScans } from "@/hooks/use-aws-accounts";
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
  Server,
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

export default function Scans() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useLocalStorage<string>("scans:statusFilter", "all");
  const [accountFilter, setAccountFilter] = useLocalStorage<string>("scans:accountFilter", "all");
  const [showArchived, setShowArchived] = useLocalStorage<boolean>("scans:showArchived", false);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [isStartingScan, setIsStartingScan] = useState(false);
  const [showStartScanDialog, setShowStartScanDialog] = useState(false);
  const [showScanAllDialog, setShowScanAllDialog] = useState(false);
  const { data: scans = [], isLoading, refetch } = useRecentScans(100, showArchived);
  const { accounts, isLoading: accountsLoading } = useAwsAccounts();
  const triggerScan = useTriggerScan();
  const { data: activeScansData } = useActiveScans();

  // Auto-refresh data when scans complete
  const { activeScans } = useScanCompletionRefresh();

  // Helper to check if account has an active scan
  const getActiveScanForAccount = (accountId: string) =>
    activeScansData?.find((scan) => scan.awsAccountId === accountId);

  const getAccountName = (awsAccountId: string | null) => {
    if (!awsAccountId) return "Deleted Account";
    const account = accounts.find((a) => a.id === awsAccountId);
    return account?.name || "Unknown Account";
  };

  const getAccountAwsId = (awsAccountId: string | null) => {
    if (!awsAccountId) return "-";
    const account = accounts.find((a) => a.id === awsAccountId);
    return account?.awsAccountId || "";
  };

  const getDuration = (scan: Scan) => {
    if (!scan.startedAt) return null;
    const start = new Date(scan.startedAt).getTime();
    const end = scan.completedAt
      ? new Date(scan.completedAt).getTime()
      : Date.now();
    return formatDuration(end - start);
  };

  const filteredScans = scans.filter((scan) => {
    if (statusFilter !== "all" && scan.status !== statusFilter) return false;
    if (accountFilter !== "all" && scan.awsAccountId !== accountFilter) return false;
    return true;
  });

  const handleScanAll = async () => {
    if (!accounts || accounts.length === 0) return;

    const results = await Promise.allSettled(
      accounts.map(account => triggerScan.mutateAsync(account.id))
    );

    const succeeded = results.filter(r => r.status === "fulfilled").length;
    const failed = results.filter(r => r.status === "rejected").length;

    if (failed === 0) {
      toast({
        title: "Scans started",
        description: `Started scanning ${succeeded} AWS account(s).`,
        type: "success",
      });
    } else if (succeeded === 0) {
      toast({
        title: "Scans failed",
        description: `Failed to start scans for all ${failed} account(s). Please try again.`,
        type: "error",
      });
    } else {
      toast({
        title: "Scans partially started",
        description: `Started ${succeeded} scan(s), ${failed} failed to start.`,
        type: "warning",
      });
    }
  };

  const handleStartScan = async () => {
    if (!selectedAccountId) return;

    setIsStartingScan(true);
    try {
      await triggerScan.mutateAsync(selectedAccountId);
      const accountName = accounts.find(a => a.id === selectedAccountId)?.name || "Account";
      toast({
        title: "Scan started",
        description: `Started scanning ${accountName}.`,
        type: "success",
      });
      setSelectedAccountId("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start scan. Please try again.";
      toast({
        title: "Scan failed",
        description: message,
        type: "error",
      });
    } finally {
      setIsStartingScan(false);
    }
  };

  const hasAccounts = accounts && accounts.length > 0;
  const hasAnyScans = scans.length > 0;
  const hasScanInProgress = (activeScans && activeScans.length > 0) ||
    scans.some(scan => ACTIVE_SCAN_STATUSES.includes(scan.status));

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Scans</h1>
          <p className="text-muted-foreground">
            View all infrastructure scan history and results
          </p>
        </div>
        {hasAnyScans && (
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        )}
      </div>

      {/* No accounts state */}
      {!accountsLoading && !hasAccounts && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-primary/10 p-4">
              <Server className="h-8 w-8 text-primary" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">No AWS accounts connected</h3>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Connect your AWS accounts to start scanning your infrastructure.
            </p>
            <Button className="mt-6" onClick={() => navigate("/accounts")}>
              Connect AWS Account
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Start Scan panel - show when there are accounts */}
      {hasAccounts && (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Play className="h-5 w-5 text-primary" />
              Start Scan
            </CardTitle>
            <CardDescription>
              Select an AWS account to scan its infrastructure
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an account to scan..." />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((account) => {
                      const activeScan = getActiveScanForAccount(account.id);
                      const isScanning = !!activeScan;
                      return (
                        <SelectItem
                          key={account.id}
                          value={account.id}
                          disabled={account.status !== "ok" || isScanning}
                        >
                          <div className="flex items-center gap-2">
                            <span>{account.name}</span>
                            <span className="text-xs text-muted-foreground">
                              ({account.awsAccountId})
                            </span>
                            {isScanning && (
                              <Badge variant="secondary" className="ml-2 text-xs">
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                {activeScan.status}
                              </Badge>
                            )}
                            {account.status !== "ok" && !isScanning && (
                              <Badge variant="outline" className="ml-2 text-xs text-muted-foreground">
                                {account.status}
                              </Badge>
                            )}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => setShowStartScanDialog(true)}
                  disabled={!selectedAccountId || isStartingScan || !!getActiveScanForAccount(selectedAccountId)}
                >
                  {isStartingScan ? (
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
                <Button
                  variant="outline"
                  onClick={() => setShowScanAllDialog(true)}
                  disabled={triggerScan.isPending || hasScanInProgress}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Scan All
                </Button>
              </div>
            </div>
            {selectedAccountId && getActiveScanForAccount(selectedAccountId) && (
              <p className="mt-3 text-sm text-muted-foreground">
                <Loader2 className="h-3 w-3 inline mr-1 animate-spin" />
                Scan already in progress for this account ({getActiveScanForAccount(selectedAccountId)?.status})
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Scan history card - show when there are accounts */}
      {hasAccounts && (
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4">
            {/* Title row */}
            <div className="flex items-start justify-between gap-4">
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
                <Checkbox
                  id="show-archived"
                  checked={showArchived}
                  onChange={(e) => setShowArchived(e.target.checked)}
                  label="Archived"
                />
              )}
            </div>
            {/* Filters row */}
            {scans.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[140px]">
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
                <Select value={accountFilter} onValueChange={setAccountFilter}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Account" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Accounts</SelectItem>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
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
                Start a scan to discover your resources and identify security issues.
              </p>
              <Button
                className="mt-6"
                onClick={() => setShowScanAllDialog(true)}
                disabled={triggerScan.isPending || hasScanInProgress}
              >
                <Play className="mr-2 h-4 w-4" />
                Start First Scan
              </Button>
            </div>
          ) : filteredScans.length === 0 ? (
            <EmptyState
              icon={History}
              title="No scans match filters"
              description="Try adjusting your filters to see more results"
            />
          ) : (
            <>
              {/* Mobile card view */}
              <div className="space-y-3 sm:hidden">
                {filteredScans.map((scan) => {
                  const config = statusConfig[scan.status] || {
                    icon: <Clock className="h-4 w-4" />,
                    label: scan.status || "Unknown",
                    variant: "secondary" as const,
                  };
                  const duration = getDuration(scan);

                  return (
                    <div key={scan.id} className="rounded-lg border p-3 space-y-2">
                      {/* Top row: Status + Account */}
                      <div className="flex items-center justify-between gap-2">
                        <Badge
                          variant={config.variant}
                          className={`flex items-center gap-1.5 ${!scan.hasKey ? "opacity-60" : ""}`}
                        >
                          <span className={
                            scan.status === "error" ? "text-destructive" :
                            scan.status === "complete" ? "text-status-success" :
                            scan.status === "partial" ? "text-status-high" :
                            scan.status === "running" || scan.status === "analyzing" ? "text-primary-foreground" :
                            scan.status === "canceled" ? "text-muted-foreground" :
                            "text-status-warning"
                          }>
                            {config.icon}
                          </span>
                          {config.label}
                        </Badge>
                        <span className="text-sm font-medium truncate">
                          {getAccountName(scan.awsAccountId)}
                        </span>
                      </div>

                      {/* Time info */}
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{scan.startedAt ? formatDateTime(scan.startedAt) : "-"}</span>
                        {duration && <span>{duration}</span>}
                      </div>

                      {/* Stats row */}
                      {(scan.status === "complete" || scan.status === "partial") && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs">
                            <span className="font-medium">{scan.resourcesDiscovered}</span> resources
                          </span>
                          {scan.resourcesDelta !== 0 && (
                            <Badge
                              variant="outline"
                              className={`text-xs ${scan.resourcesDelta > 0 ? "text-status-success border-status-success" : "text-status-high border-status-high"}`}
                            >
                              {scan.resourcesDelta > 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                              {scan.resourcesDelta > 0 ? "+" : ""}{scan.resourcesDelta}
                            </Badge>
                          )}
                          {scan.findingsNew > 0 && (
                            <Badge variant="outline" className="text-xs text-status-warning border-status-warning">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              +{scan.findingsNew}
                            </Badge>
                          )}
                          {scan.findingsResolved > 0 && (
                            <Badge variant="outline" className="text-xs text-status-success border-status-success">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              -{scan.findingsResolved}
                            </Badge>
                          )}
                        </div>
                      )}

                      {/* Error message */}
                      {scan.errorMessage && (
                        <div className="flex items-start gap-1.5 text-xs text-destructive">
                          <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                          <span className="line-clamp-2">{scan.errorMessage}</span>
                        </div>
                      )}

                      {!scan.hasKey && (
                        <span className="text-xs text-muted-foreground">(archived)</span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Desktop table view */}
              <div className="rounded-md border hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead className="hidden lg:table-cell">AWS Account ID</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead className="hidden md:table-cell">Completed</TableHead>
                      <TableHead className="hidden md:table-cell">Duration</TableHead>
                      <TableHead className="text-right">Resources</TableHead>
                      <TableHead className="text-right hidden lg:table-cell">Changes</TableHead>
                      <TableHead className="text-right">Findings</TableHead>
                      <TableHead className="hidden xl:table-cell">Error</TableHead>
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
                                scan.status === "complete" ? "text-status-success" :
                                scan.status === "partial" ? "text-status-high" :
                                scan.status === "running" || scan.status === "analyzing" ? "text-primary-foreground" :
                                scan.status === "canceled" ? "text-muted-foreground" :
                                "text-status-warning"
                              }>
                                {config.icon}
                              </span>
                              {config.label}
                            </Badge>
                            {!scan.hasKey && (
                              <span className="ml-1 text-xs text-muted-foreground">(archived)</span>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">
                            {getAccountName(scan.awsAccountId)}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground hidden lg:table-cell">
                            {getAccountAwsId(scan.awsAccountId)}
                          </TableCell>
                          <TableCell className="text-sm">
                            {scan.startedAt ? formatDateTime(scan.startedAt) : "-"}
                          </TableCell>
                          <TableCell className="text-sm hidden md:table-cell">
                            {scan.completedAt ? formatDateTime(scan.completedAt) : "-"}
                          </TableCell>
                          <TableCell className="text-sm hidden md:table-cell">
                            {duration || "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            {(scan.status === "complete" || scan.status === "partial") ? (
                              <span className="font-medium">{scan.resourcesDiscovered}</span>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell className="text-right hidden lg:table-cell">
                            {(scan.status === "complete" || scan.status === "partial") && scan.resourcesDelta !== 0 ? (
                              <Badge
                                variant="outline"
                                className={`text-xs ${scan.resourcesDelta > 0 ? "text-status-success border-status-success" : "text-status-high border-status-high"}`}
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
                                <Badge variant="outline" className="text-xs text-status-warning border-status-warning">
                                  <AlertCircle className="h-3 w-3 mr-1" />
                                  +{scan.findingsNew}
                                </Badge>
                              )}
                              {(scan.status === "complete" || scan.status === "partial") && scan.findingsResolved > 0 && (
                                <Badge variant="outline" className="text-xs text-status-success border-status-success">
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
                          <TableCell className="max-w-[200px] hidden xl:table-cell">
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
            </>
          )}
        </CardContent>
      </Card>
      )}

      {/* Start Scan confirmation dialog */}
      <Dialog open={showStartScanDialog} onOpenChange={setShowStartScanDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Scan</DialogTitle>
            <DialogDescription>
              Are you sure you want to scan{" "}
              <span className="font-medium text-foreground">
                {accounts.find(a => a.id === selectedAccountId)?.name || "this account"}
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
              disabled={isStartingScan}
            >
              <Play className="mr-2 h-4 w-4" />
              Start Scan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Scan All confirmation dialog */}
      <Dialog open={showScanAllDialog} onOpenChange={setShowScanAllDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Scan All Accounts</DialogTitle>
            <DialogDescription>
              This will start a scan for all {accounts?.length || 0} connected AWS account(s).
              Scanning may take several minutes depending on the size of your infrastructure.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowScanAllDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setShowScanAllDialog(false);
                handleScanAll();
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
