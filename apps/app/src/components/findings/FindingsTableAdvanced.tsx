import { useState, useMemo, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { SeverityBadge } from "@/components/shared/SeverityBadge";
import { FindingStatusBadge } from "@/components/shared/StatusBadge";
import { formatRelativeTime, formatCurrency } from "@/lib/utils";
import { useLocalStorage } from "@/hooks/use-local-storage";
import type { Finding } from "@/types";
import {
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronsLeft,
  ChevronLeft,
  ChevronRightIcon,
  ChevronsRight,
  DollarSign,
  RefreshCw,
} from "lucide-react";

interface FindingsTableAdvancedProps {
  findings: Finding[];
  onSelectFinding: (finding: Finding) => void;
  isLoading?: boolean;
  onBulkAction?: (ids: string[], action: "resolve" | "ignore" | "snooze") => void;
}

type SortField = "severity" | "type" | "status" | "savings" | "createdAt";
type SortDirection = "asc" | "desc";

const typeLabels: Record<string, string> = {
  // Orphan findings
  orphaned_volume: "Orphaned Volume",
  orphaned_eip: "Orphaned EIP",
  orphaned_snapshot: "Orphaned Snapshot",
  // SSL findings
  ssl_expiry: "SSL Expiry",
  // Compliance findings
  data_residency_violation: "Data Residency",
  cloudtrail_disabled: "CloudTrail Disabled",
  vpc_flow_logs_disabled: "VPC Flow Logs Disabled",
  backup_not_configured: "Backup Not Configured",
  // Security findings
  unencrypted_resource: "Unencrypted Resource",
  public_access: "Public Access",
  permissive_security_group: "Permissive Security Group",
  open_all_ports: "Open All Ports",
  publicly_accessible_rds: "Publicly Accessible RDS",
  public_snapshot: "Public Snapshot",
  insecure_tls: "Insecure TLS",
  // Cost findings
  unused_resource: "Unused Resource",
  stopped_instance: "Stopped Instance",
  unused_log_group: "Unused Log Group",
  idle_nat_gateway: "Idle NAT Gateway",
  oversized_instance: "Oversized Instance",
  // Tagging findings
  missing_tag: "Missing Tag",
  // IAM findings
  old_access_key: "Old Access Key",
  unused_access_key: "Unused Access Key",
  unused_iam_role: "Unused IAM Role",
  user_without_mfa: "User Without MFA",
  root_account_usage: "Root Account Usage",
  overly_permissive_policy: "Overly Permissive Policy",
  cross_account_trust: "Cross Account Trust",
};

const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, trivial: 4 };
const statusOrder: Record<string, number> = { open: 0, snoozed: 1, ignored: 2, resolved: 3 };

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export function FindingsTableAdvanced({
  findings,
  onSelectFinding,
  isLoading,
  onBulkAction,
}: FindingsTableAdvancedProps) {
  const [sortField, setSortField] = useLocalStorage<SortField>("findings:sortField", "severity");
  const [sortDirection, setSortDirection] = useLocalStorage<SortDirection>("findings:sortDirection", "asc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useLocalStorage<number>("findings:pageSize", 25);

  // Sort findings
  const sortedFindings = useMemo(() => {
    return [...findings].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "severity":
          comparison = severityOrder[a.severity] - severityOrder[b.severity];
          break;
        case "type":
          comparison = a.type.localeCompare(b.type);
          break;
        case "status":
          comparison = statusOrder[a.status] - statusOrder[b.status];
          break;
        case "savings":
          const savingsA = typeof a.details.estimatedSavings === "number" ? a.details.estimatedSavings : 0;
          const savingsB = typeof b.details.estimatedSavings === "number" ? b.details.estimatedSavings : 0;
          comparison = savingsB - savingsA; // Higher savings first by default
          break;
        case "createdAt":
          // Use firstDetectedAt when available, fallback to createdAt
          const dateA = new Date(a.firstDetectedAt || a.createdAt).getTime();
          const dateB = new Date(b.firstDetectedAt || b.createdAt).getTime();
          comparison = dateB - dateA;
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [findings, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(sortedFindings.length / pageSize);
  const paginatedFindings = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedFindings.slice(start, start + pageSize);
  }, [sortedFindings, currentPage, pageSize]);

  // Reset page when findings change
  useEffect(() => {
    setCurrentPage(1);
  }, [findings.length]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedFindings.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedFindings.map((f) => f.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const SortableHeader = ({
    field,
    children,
    className,
  }: {
    field: SortField;
    children: React.ReactNode;
    className?: string;
  }) => (
    <TableHead className={className}>
      <button
        onClick={() => handleSort(field)}
        className="flex items-center gap-1 hover:text-foreground transition-colors -ml-2 px-2 py-1 rounded"
      >
        {children}
        {sortField === field ? (
          sortDirection === "asc" ? (
            <ArrowUp className="h-4 w-4" />
          ) : (
            <ArrowDown className="h-4 w-4" />
          )
        ) : (
          <ArrowUpDown className="h-4 w-4 opacity-50" />
        )}
      </button>
    </TableHead>
  );

  if (isLoading) {
    return (
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12" />
              <TableHead>Severity</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="hidden md:table-cell">Summary</TableHead>
              <TableHead className="hidden lg:table-cell">Status</TableHead>
              <TableHead className="hidden lg:table-cell text-right">Savings</TableHead>
              <TableHead className="text-right">Detected</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(5)].map((_, i) => (
              <TableRow key={i} className="animate-pulse">
                <TableCell>
                  <div className="h-4 w-4 rounded bg-muted" />
                </TableCell>
                <TableCell>
                  <div className="h-5 w-16 rounded bg-muted" />
                </TableCell>
                <TableCell>
                  <div className="h-4 w-32 rounded bg-muted" />
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <div className="h-4 w-48 rounded bg-muted" />
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <div className="h-5 w-16 rounded bg-muted" />
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <div className="h-4 w-16 rounded bg-muted ml-auto" />
                </TableCell>
                <TableCell>
                  <div className="h-4 w-20 rounded bg-muted ml-auto" />
                </TableCell>
                <TableCell>
                  <div className="h-4 w-4 rounded bg-muted" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Selection info & bulk actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-4 rounded-lg border bg-muted/50 px-4 py-2">
          <span className="text-sm">
            <span className="font-medium">{selectedIds.size}</span> selected
          </span>
          {onBulkAction && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onBulkAction(Array.from(selectedIds), "resolve")}
              >
                Mark Resolved
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onBulkAction(Array.from(selectedIds), "ignore")}
              >
                Ignore
              </Button>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedIds(new Set())}
          >
            Clear selection
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-12">
                <Checkbox
                  checked={
                    paginatedFindings.length > 0 &&
                    selectedIds.size === paginatedFindings.length
                  }
                  onChange={toggleSelectAll}
                  aria-label="Select all"
                />
              </TableHead>
              <SortableHeader field="severity">Severity</SortableHeader>
              <SortableHeader field="type">Type</SortableHeader>
              <TableHead className="hidden md:table-cell">Summary</TableHead>
              <SortableHeader field="status" className="hidden lg:table-cell">
                Status
              </SortableHeader>
              <SortableHeader field="savings" className="hidden lg:table-cell text-right">
                Savings
              </SortableHeader>
              <SortableHeader field="createdAt" className="text-right">
                Detected
              </SortableHeader>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedFindings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                  No findings found
                </TableCell>
              </TableRow>
            ) : (
              paginatedFindings.map((finding) => (
                <TableRow
                  key={finding.id}
                  className="cursor-pointer group"
                  onClick={() => onSelectFinding(finding)}
                  data-selected={selectedIds.has(finding.id)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.has(finding.id)}
                      onChange={() => toggleSelect(finding.id)}
                      aria-label={`Select finding`}
                    />
                  </TableCell>
                  <TableCell>
                    <SeverityBadge severity={finding.severity} />
                  </TableCell>
                  <TableCell>
                    <span className="font-medium text-sm">
                      {typeLabels[finding.type] || finding.type}
                    </span>
                  </TableCell>
                  <TableCell className="hidden max-w-[300px] truncate md:table-cell">
                    <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                      {finding.summary}
                    </span>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <FindingStatusBadge status={finding.status} />
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-right">
                    {typeof finding.details.estimatedSavings === "number" ? (
                      <span className="flex items-center justify-end gap-1 text-green-600 font-medium">
                        <DollarSign className="h-3 w-3" />
                        {formatCurrency(finding.details.estimatedSavings)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {(finding.detectionCount || 1) > 1 && (
                        <span
                          className="flex items-center gap-0.5 text-xs text-amber-600"
                          title={`Detected ${finding.detectionCount} times`}
                        >
                          <RefreshCw className="h-3 w-3" />
                          {finding.detectionCount}
                        </span>
                      )}
                      <span className="text-sm text-muted-foreground">
                        {formatRelativeTime(finding.firstDetectedAt || finding.createdAt)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {sortedFindings.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Page size selector */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="h-8 rounded border bg-background px-2 text-sm"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>

          {/* Page info and navigation */}
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages} ({sortedFindings.length} total)
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRightIcon className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
