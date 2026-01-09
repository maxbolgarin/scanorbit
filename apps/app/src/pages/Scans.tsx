import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { useRecentScans, useAwsAccounts } from "@/hooks/use-aws-accounts";
import { formatDateTime, formatDuration } from "@/lib/utils";
import type { Scan, ScanStatus } from "@/types";
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
} from "lucide-react";

const statusConfig: Record<
  ScanStatus,
  { icon: React.ReactNode; label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  pending: {
    icon: <Clock className="h-4 w-4" />,
    label: "Pending",
    variant: "secondary",
  },
  running: {
    icon: <PlayCircle className="h-4 w-4 animate-pulse" />,
    label: "Running",
    variant: "default",
  },
  complete: {
    icon: <CheckCircle2 className="h-4 w-4" />,
    label: "Completed",
    variant: "outline",
  },
  error: {
    icon: <XCircle className="h-4 w-4" />,
    label: "Failed",
    variant: "destructive",
  },
};

export default function Scans() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [accountFilter, setAccountFilter] = useState<string>("all");
  const { data: scans = [], isLoading, refetch } = useRecentScans(100);
  const { accounts } = useAwsAccounts();

  const getAccountName = (awsAccountId: string) => {
    const account = accounts.find((a) => a.id === awsAccountId);
    return account?.name || "Unknown Account";
  };

  const getAccountAwsId = (awsAccountId: string) => {
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
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <History className="h-5 w-5 text-muted-foreground" />
                Scan History
              </CardTitle>
              <CardDescription>
                {filteredScans.length} scan{filteredScans.length !== 1 ? "s" : ""} found
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="running">Running</SelectItem>
                  <SelectItem value="complete">Completed</SelectItem>
                  <SelectItem value="error">Failed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={accountFilter} onValueChange={setAccountFilter}>
                <SelectTrigger className="w-[180px]">
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
          </div>
        </CardHeader>
        <CardContent>
          {filteredScans.length === 0 ? (
            <EmptyState
              icon={History}
              title="No scans found"
              description={
                statusFilter !== "all" || accountFilter !== "all"
                  ? "Try adjusting your filters"
                  : "Connect an AWS account and run your first scan"
              }
            />
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>AWS Account ID</TableHead>
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
                    const config = statusConfig[scan.status];
                    const duration = getDuration(scan);

                    return (
                      <TableRow key={scan.id}>
                        <TableCell>
                          <Badge
                            variant={config.variant}
                            className="flex items-center gap-1.5 w-fit"
                          >
                            <span className={
                              scan.status === "error" ? "text-destructive" :
                              scan.status === "complete" ? "text-green-500" :
                              scan.status === "running" ? "text-primary" :
                              "text-yellow-500"
                            }>
                              {config.icon}
                            </span>
                            {config.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          {getAccountName(scan.awsAccountId)}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {getAccountAwsId(scan.awsAccountId)}
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
                          {scan.status === "complete" ? (
                            <span className="font-medium">{scan.resourcesDiscovered}</span>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {scan.status === "complete" && scan.resourcesDelta !== 0 ? (
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
                            {scan.status === "complete" && scan.findingsNew > 0 && (
                              <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-600">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                +{scan.findingsNew}
                              </Badge>
                            )}
                            {scan.status === "complete" && scan.findingsResolved > 0 && (
                              <Badge variant="outline" className="text-xs text-green-600 border-green-600">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                -{scan.findingsResolved}
                              </Badge>
                            )}
                            {scan.status === "complete" && scan.findingsNew === 0 && scan.findingsResolved === 0 && (
                              <span className="text-muted-foreground">-</span>
                            )}
                            {scan.status !== "complete" && (
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
    </div>
  );
}
