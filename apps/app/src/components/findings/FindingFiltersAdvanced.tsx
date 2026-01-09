import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { FindingFilters as Filters, FindingType, FindingSeverity, FindingStatus } from "@/types";
import { Search, X, SlidersHorizontal, ChevronDown, ChevronUp } from "lucide-react";

interface FindingFiltersAdvancedProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  totalCount: number;
  filteredCount: number;
}

const typeOptions: { value: FindingType; label: string; category: string }[] = [
  // Security findings
  { value: "unencrypted_resource", label: "Unencrypted Resource", category: "Security" },
  { value: "public_access", label: "Public Access", category: "Security" },
  { value: "permissive_security_group", label: "Permissive Security Group", category: "Security" },
  { value: "open_all_ports", label: "Open All Ports", category: "Security" },
  // Cost findings
  { value: "orphaned_volume", label: "Orphaned Volume", category: "Cost" },
  { value: "orphaned_eip", label: "Orphaned EIP", category: "Cost" },
  { value: "orphaned_snapshot", label: "Orphaned Snapshot", category: "Cost" },
  { value: "unused_resource", label: "Unused Resource", category: "Cost" },
  { value: "stopped_instance", label: "Stopped Instance", category: "Cost" },
  { value: "unused_log_group", label: "Unused Log Group", category: "Cost" },
  // Compliance findings
  { value: "ssl_expiry", label: "SSL Expiry", category: "Compliance" },
  { value: "data_residency_violation", label: "Data Residency", category: "Compliance" },
  // IAM findings
  { value: "old_access_key", label: "Old Access Key", category: "IAM" },
  { value: "unused_access_key", label: "Unused Access Key", category: "IAM" },
  { value: "unused_iam_role", label: "Unused IAM Role", category: "IAM" },
  { value: "user_without_mfa", label: "User Without MFA", category: "IAM" },
  // Tagging findings
  { value: "missing_tag", label: "Missing Tag", category: "Tagging" },
];

const severityOptions: { value: FindingSeverity; label: string; color: string }[] = [
  { value: "high", label: "High", color: "text-red-500" },
  { value: "medium", label: "Medium", color: "text-yellow-500" },
  { value: "low", label: "Low", color: "text-blue-500" },
];

const statusOptions: { value: FindingStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "resolved", label: "Resolved" },
  { value: "snoozed", label: "Snoozed" },
  { value: "ignored", label: "Ignored" },
];

// Group types by category for the dropdown
const groupedTypes = typeOptions.reduce((acc, type) => {
  if (!acc[type.category]) {
    acc[type.category] = [];
  }
  acc[type.category].push(type);
  return acc;
}, {} as Record<string, typeof typeOptions>);

export function FindingFiltersAdvanced({
  filters,
  onFiltersChange,
  searchQuery,
  onSearchChange,
  totalCount,
  filteredCount,
}: FindingFiltersAdvancedProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const hasFilters = filters.type || filters.severity || filters.status || searchQuery;
  const activeFilterCount = [filters.type, filters.severity, filters.status, searchQuery].filter(Boolean).length;

  const clearFilters = () => {
    onFiltersChange({});
    onSearchChange("");
  };

  const clearSingleFilter = (key: keyof Filters) => {
    const newFilters = { ...filters };
    delete newFilters[key];
    onFiltersChange(newFilters);
  };

  const getTypeLabel = (type: FindingType) => {
    return typeOptions.find(t => t.value === type)?.label || type;
  };

  const getSeverityColor = (severity: FindingSeverity) => {
    return severityOptions.find(s => s.value === severity)?.color || "";
  };

  return (
    <div className="space-y-4">
      {/* Main filter row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Search input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by summary..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 pr-9"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Quick filters */}
        <div className="flex flex-wrap gap-2">
          {/* Severity filter */}
          <Select
            value={filters.severity || "all"}
            onValueChange={(value) =>
              onFiltersChange({
                ...filters,
                severity: value === "all" ? undefined : (value as FindingSeverity),
              })
            }
          >
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severities</SelectItem>
              {severityOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  <span className={option.color}>{option.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status filter */}
          <Select
            value={filters.status || "all"}
            onValueChange={(value) =>
              onFiltersChange({
                ...filters,
                status: value === "all" ? undefined : (value as FindingStatus),
              })
            }
          >
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {statusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Advanced filters toggle */}
          <Button
            variant="outline"
            size="default"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={showAdvanced ? "bg-muted" : ""}
          >
            <SlidersHorizontal className="mr-2 h-4 w-4" />
            Type
            {showAdvanced ? (
              <ChevronUp className="ml-1 h-4 w-4" />
            ) : (
              <ChevronDown className="ml-1 h-4 w-4" />
            )}
          </Button>

          {/* Clear all button */}
          {hasFilters && (
            <Button variant="ghost" onClick={clearFilters}>
              <X className="mr-1 h-4 w-4" />
              Clear all
            </Button>
          )}
        </div>
      </div>

      {/* Advanced filters - Type selection */}
      {showAdvanced && (
        <div className="rounded-lg border bg-muted/30 p-4">
          <p className="text-sm font-medium text-muted-foreground mb-3">Filter by Type</p>
          <Select
            value={filters.type || "all"}
            onValueChange={(value) =>
              onFiltersChange({
                ...filters,
                type: value === "all" ? undefined : (value as FindingType),
              })
            }
          >
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {Object.entries(groupedTypes).map(([category, types]) => (
                <div key={category}>
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                    {category}
                  </div>
                  {types.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </div>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Active filters badges & count */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Result count */}
        <span className="text-sm text-muted-foreground">
          {hasFilters ? (
            <>
              Showing <span className="font-medium text-foreground">{filteredCount.toLocaleString()}</span> of{" "}
              {totalCount.toLocaleString()} findings
            </>
          ) : (
            <>
              <span className="font-medium text-foreground">{totalCount.toLocaleString()}</span> findings
            </>
          )}
        </span>

        {/* Active filter badges */}
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap gap-1.5 ml-2">
            {searchQuery && (
              <Badge variant="secondary" className="gap-1 pr-1">
                Search: "{searchQuery.length > 15 ? searchQuery.slice(0, 15) + "..." : searchQuery}"
                <button
                  onClick={() => onSearchChange("")}
                  className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {filters.severity && (
              <Badge variant="secondary" className="gap-1 pr-1">
                <span className={getSeverityColor(filters.severity)}>
                  {filters.severity.charAt(0).toUpperCase() + filters.severity.slice(1)}
                </span>
                <button
                  onClick={() => clearSingleFilter("severity")}
                  className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {filters.status && (
              <Badge variant="secondary" className="gap-1 pr-1">
                {filters.status.charAt(0).toUpperCase() + filters.status.slice(1)}
                <button
                  onClick={() => clearSingleFilter("status")}
                  className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {filters.type && (
              <Badge variant="secondary" className="gap-1 pr-1">
                {getTypeLabel(filters.type)}
                <button
                  onClick={() => clearSingleFilter("type")}
                  className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
