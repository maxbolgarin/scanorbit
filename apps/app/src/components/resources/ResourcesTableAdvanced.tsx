import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ServiceIcon, getServiceLabel } from "@/components/shared/ServiceIcon";
import { formatCurrency, formatRelativeTime } from "@/lib/utils";
import { useLocalStorage } from "@/hooks/use-local-storage";
import type { Resource } from "@/types";
import {
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronsLeft,
  ChevronLeft,
  ChevronRightIcon,
  ChevronsRight,
} from "lucide-react";

interface ResourcesTableAdvancedProps {
  resources: Resource[];
  isLoading?: boolean;
  initialSortField?: SortField;
  initialSortDirection?: SortDirection;
  baseUrl?: string;
}

type SortField = "name" | "service" | "region" | "state" | "cost" | "lastSeen";
type SortDirection = "asc" | "desc";

const stateColors: Record<string, "success" | "warning" | "secondary" | "destructive"> = {
  running: "success",
  active: "success",
  "in-use": "success",
  available: "warning",
  stopped: "secondary",
  inactive: "secondary",
};

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export function ResourcesTableAdvanced({
  resources,
  isLoading,
  initialSortField,
  initialSortDirection,
  baseUrl = "",
}: ResourcesTableAdvancedProps) {
  const navigate = useNavigate();
  const [sortField, setSortField] = useLocalStorage<SortField>(
    "resources:sortField",
    initialSortField ?? "lastSeen"
  );
  const [sortDirection, setSortDirection] = useLocalStorage<SortDirection>(
    "resources:sortDirection",
    initialSortDirection ?? "desc"
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useLocalStorage<number>("resources:pageSize", 25);

  // Apply initial sort values when they change (from external trigger like stats card click)
  useEffect(() => {
    if (initialSortField) {
      setSortField(initialSortField);
    }
    if (initialSortDirection) {
      setSortDirection(initialSortDirection);
    }
  }, [initialSortField, initialSortDirection, setSortField, setSortDirection]);

  // Sort resources
  const sortedResources = useMemo(() => {
    return [...resources].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "name":
          comparison = (a.name || "").localeCompare(b.name || "");
          break;
        case "service":
          comparison = a.service.localeCompare(b.service);
          break;
        case "region":
          comparison = (a.region || "").localeCompare(b.region || "");
          break;
        case "state":
          comparison = (a.state || "").localeCompare(b.state || "");
          break;
        case "cost":
          const costA = a.costEstimateMonthly ? parseFloat(a.costEstimateMonthly) : 0;
          const costB = b.costEstimateMonthly ? parseFloat(b.costEstimateMonthly) : 0;
          comparison = costA - costB;
          break;
        case "lastSeen":
          comparison = new Date(a.lastSeenAt).getTime() - new Date(b.lastSeenAt).getTime();
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [resources, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(sortedResources.length / pageSize);
  const paginatedResources = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedResources.slice(start, start + pageSize);
  }, [sortedResources, currentPage, pageSize]);

  // Reset page when resources change
  useEffect(() => {
    setCurrentPage(1);
  }, [resources.length]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
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
              <TableHead>Service</TableHead>
              <TableHead>Name / ID</TableHead>
              <TableHead className="hidden md:table-cell">Region</TableHead>
              <TableHead className="hidden lg:table-cell">State</TableHead>
              <TableHead className="hidden lg:table-cell text-right">Est. Cost</TableHead>
              <TableHead className="hidden md:table-cell text-right">Last Seen</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(5)].map((_, i) => (
              <TableRow key={i} className="animate-pulse">
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-5 rounded bg-muted" />
                    <div className="h-4 w-16 rounded bg-muted" />
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <div className="h-4 w-32 rounded bg-muted" />
                    <div className="h-3 w-48 rounded bg-muted" />
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <div className="h-4 w-24 rounded bg-muted" />
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <div className="h-5 w-16 rounded bg-muted" />
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <div className="h-4 w-16 rounded bg-muted ml-auto" />
                </TableCell>
                <TableCell className="hidden md:table-cell">
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
      {/* Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <SortableHeader field="service">Service</SortableHeader>
              <SortableHeader field="name">Name / ID</SortableHeader>
              <SortableHeader field="region" className="hidden md:table-cell">
                Region
              </SortableHeader>
              <SortableHeader field="state" className="hidden lg:table-cell">
                State
              </SortableHeader>
              <SortableHeader field="cost" className="hidden lg:table-cell text-right">
                Est. Cost
              </SortableHeader>
              <SortableHeader field="lastSeen" className="hidden md:table-cell text-right">
                Last Seen
              </SortableHeader>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedResources.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                  No resources found
                </TableCell>
              </TableRow>
            ) : (
              paginatedResources.map((resource) => (
                <TableRow
                  key={resource.id}
                  className="cursor-pointer group"
                  onClick={() => navigate(`${baseUrl ? baseUrl : ""}/resources/${resource.id}`)}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <ServiceIcon service={resource.service} className="h-5 w-5" />
                      <span className="hidden sm:inline font-medium text-sm">
                        {getServiceLabel(resource.service)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-0.5">
                      <p className="font-medium group-hover:text-primary transition-colors">
                        {resource.name || "-"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate max-w-[250px] font-mono">
                        {resource.resourceId}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <span className="text-sm">{resource.region || "-"}</span>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {resource.state ? (
                      <Badge
                        variant={stateColors[resource.state] || "secondary"}
                        className="capitalize"
                      >
                        {resource.state}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-right">
                    <span className="text-sm font-medium">
                      {resource.costEstimateMonthly
                        ? formatCurrency(parseFloat(resource.costEstimateMonthly))
                        : "-"}
                    </span>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-right">
                    <span className="text-sm text-muted-foreground">
                      {formatRelativeTime(resource.lastSeenAt)}
                    </span>
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
      {sortedResources.length > 0 && (
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
              Page {currentPage} of {totalPages} ({sortedResources.length} total)
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
