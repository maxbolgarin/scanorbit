import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "@/hooks/use-toast";
import * as api from "@/lib/api";
import { ChevronLeft, ChevronRight, ScrollText, Download, X } from "lucide-react";

const ACTION_OPTIONS = [
  { value: "all", label: "All Actions" },
  { value: "login", label: "Login" },
  { value: "logout", label: "Logout" },
  { value: "read", label: "Read" },
  { value: "create", label: "Create" },
  { value: "update", label: "Update" },
  { value: "delete", label: "Delete" },
  { value: "export", label: "Export" },
];

function formatTimestamp(ts: string) {
  return new Date(ts).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getActionBadgeVariant(action: string) {
  switch (action) {
    case "create":
    case "login":
      return "default" as const;
    case "delete":
      return "destructive" as const;
    case "update":
      return "secondary" as const;
    default:
      return "outline" as const;
  }
}

function auditLogsToCsv(logs: api.AuditLogEntry[]): string {
  const headers = ["Timestamp", "User", "Email", "Action", "Method", "Path", "Status Code", "IP Address", "Duration (ms)"];
  const rows = logs.map((log) => [
    log.timestamp,
    log.userFullName || "",
    log.userEmail || "",
    log.action,
    log.method || "",
    log.path || "",
    log.statusCode?.toString() || "",
    log.ipAddress || "",
    log.durationMs?.toString() || "",
  ]);

  const escape = (val: string) => {
    if (val.includes(",") || val.includes('"') || val.includes("\n")) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  return [
    headers.map(escape).join(","),
    ...rows.map((row) => row.map(escape).join(",")),
  ].join("\n");
}

export function AuditLogSettings() {
  const { org } = useAuthStore();
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [exporting, setExporting] = useState(false);
  const limit = 25;

  const queryParams = {
    page,
    limit,
    action: actionFilter !== "all" ? actionFilter : undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  };

  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs", org?.id, page, actionFilter, startDate, endDate],
    queryFn: () => api.getAuditLogs(org!.id, queryParams),
    enabled: !!org?.id,
  });

  const handleActionChange = (value: string) => {
    setActionFilter(value);
    setPage(1);
  };

  const handleStartDateChange = (value: string) => {
    setStartDate(value);
    setPage(1);
  };

  const handleEndDateChange = (value: string) => {
    setEndDate(value);
    setPage(1);
  };

  const handleClearFilters = () => {
    setActionFilter("all");
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  const hasActiveFilters = actionFilter !== "all" || startDate || endDate;

  const handleExport = async () => {
    setExporting(true);
    try {
      const result = await api.getAuditLogs(org!.id, {
        limit: 1000,
        action: actionFilter !== "all" ? actionFilter : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      const csv = auditLogsToCsv(result.data);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "scanorbit-audit-log.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Export failed", description: "Could not export audit logs.", type: "error" });
    } finally {
      setExporting(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <LoadingSpinner />
        </CardContent>
      </Card>
    );
  }

  const logs = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ScrollText className="h-5 w-5" />
              Audit Log
            </CardTitle>
            <CardDescription>
              Track all actions performed by team members in your organization.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={exporting}
          >
            <Download className={`mr-2 h-4 w-4 ${exporting ? "animate-pulse" : ""}`} />
            Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Select value={actionFilter} onValueChange={handleActionChange}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Action" />
            </SelectTrigger>
            <SelectContent>
              {ACTION_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={startDate}
              onChange={(e) => handleStartDateChange(e.target.value)}
              className="w-[160px]"
              placeholder="Start date"
            />
            <span className="text-muted-foreground text-sm">to</span>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => handleEndDateChange(e.target.value)}
              className="w-[160px]"
              placeholder="End date"
            />
          </div>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={handleClearFilters}>
              <X className="mr-1 h-3 w-3" />
              Clear
            </Button>
          )}
        </div>

        {logs.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <ScrollText className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="font-medium">No audit logs found</p>
            <p className="text-sm text-muted-foreground">
              {hasActiveFilters
                ? "Try adjusting your filters."
                : "Activity will appear here as team members use ScanOrbit."}
            </p>
          </div>
        ) : (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Path</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {formatTimestamp(log.timestamp)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {log.userFullName || log.userEmail || "System"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getActionBadgeVariant(log.action)}>
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground font-mono">
                        {log.method && log.path
                          ? `${log.method} ${log.path}`
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {log.statusCode ?? "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between pt-4">
                <p className="text-sm text-muted-foreground">
                  Page {pagination.page} of {pagination.totalPages} ({pagination.total} entries)
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page >= pagination.totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
