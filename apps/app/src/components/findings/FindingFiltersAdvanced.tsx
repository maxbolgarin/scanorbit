import { useState, useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { FindingFilters as Filters, FindingType, FindingSeverity, FindingStatus } from "@/types";
import { ORPHANED_FINDING_TYPES } from "@/types";
import { Search, X, SlidersHorizontal, ChevronDown, HardDrive, EyeOff } from "lucide-react";
import { useViewingSettingsStore } from "@/stores/settings-store";

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
  { value: "publicly_accessible_rds", label: "Publicly Accessible RDS", category: "Security" },
  { value: "public_snapshot", label: "Public Snapshot", category: "Security" },
  { value: "insecure_tls", label: "Insecure TLS", category: "Security" },
  // Cost findings (including orphaned resources)
  { value: "orphaned_volume", label: "Orphaned Volume", category: "Cost" },
  { value: "orphaned_eip", label: "Orphaned EIP", category: "Cost" },
  { value: "orphaned_snapshot", label: "Orphaned Snapshot", category: "Cost" },
  { value: "orphaned_eni", label: "Orphaned ENI", category: "Cost" },
  { value: "idle_load_balancer", label: "Idle Load Balancer", category: "Cost" },
  { value: "idle_nat_gateway", label: "Idle NAT Gateway", category: "Cost" },
  { value: "unused_security_group", label: "Unused Security Group", category: "Cost" },
  { value: "unused_resource", label: "Unused Resource", category: "Cost" },
  { value: "stopped_instance", label: "Stopped Instance", category: "Cost" },
  { value: "unused_log_group", label: "Unused Log Group", category: "Cost" },
  { value: "oversized_instance", label: "Oversized Instance", category: "Cost" },
  // Compliance findings
  { value: "ssl_expiry", label: "SSL Expiry", category: "Compliance" },
  { value: "data_residency_violation", label: "Data Residency", category: "Compliance" },
  { value: "cloudtrail_disabled", label: "CloudTrail Disabled", category: "Compliance" },
  { value: "vpc_flow_logs_disabled", label: "VPC Flow Logs Disabled", category: "Compliance" },
  { value: "backup_not_configured", label: "Backup Not Configured", category: "Compliance" },
  // IAM findings
  { value: "old_access_key", label: "Old Access Key", category: "IAM" },
  { value: "unused_access_key", label: "Unused Access Key", category: "IAM" },
  { value: "unused_iam_role", label: "Unused IAM Role", category: "IAM" },
  { value: "user_without_mfa", label: "User Without MFA", category: "IAM" },
  { value: "root_account_usage", label: "Root Account Usage", category: "IAM" },
  { value: "overly_permissive_policy", label: "Overly Permissive Policy", category: "IAM" },
  { value: "cross_account_trust", label: "Cross Account Trust", category: "IAM" },
  // Tagging findings
  { value: "missing_tag", label: "Missing Tag", category: "Tagging" },
];

const severityOptions: { value: FindingSeverity; label: string; color: string }[] = [
  { value: "critical", label: "Critical", color: "text-red-600" },
  { value: "high", label: "High", color: "text-red-500" },
  { value: "medium", label: "Medium", color: "text-yellow-500" },
  { value: "low", label: "Low", color: "text-blue-500" },
  { value: "trivial", label: "Trivial", color: "text-muted-foreground" },
];

const statusOptions: { value: FindingStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "resolved", label: "Resolved" },
  { value: "snoozed", label: "Snoozed" },
  { value: "ignored", label: "Ignored" },
];

// Group types by category
const groupedTypes = typeOptions.reduce((acc, type) => {
  if (!acc[type.category]) {
    acc[type.category] = [];
  }
  acc[type.category].push(type);
  return acc;
}, {} as Record<string, typeof typeOptions>);

// Category order for display
const categoryOrder = ["Security", "Cost", "Compliance", "IAM", "Tagging"];

export function FindingFiltersAdvanced({
  filters,
  onFiltersChange,
  searchQuery,
  onSearchChange,
  totalCount,
  filteredCount,
}: FindingFiltersAdvancedProps) {
  const [typePopoverOpen, setTypePopoverOpen] = useState(false);
  const hideTrivial = useViewingSettingsStore((state) => state.settings.hideTrivial);
  const updateSettings = useViewingSettingsStore((state) => state.updateSettings);

  // Get selected types (either from types array or single type)
  const selectedTypes = useMemo(() => {
    if (filters.types && filters.types.length > 0) {
      return filters.types;
    }
    if (filters.type) {
      return [filters.type];
    }
    return [];
  }, [filters.types, filters.type]);

  // Check if all orphaned types are selected
  const isOrphanedSelected = useMemo(() => {
    return ORPHANED_FINDING_TYPES.every((t) => selectedTypes.includes(t));
  }, [selectedTypes]);

  const hasFilters = selectedTypes.length > 0 || filters.severity || filters.status || searchQuery;

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
    return typeOptions.find((t) => t.value === type)?.label || type;
  };

  const getSeverityColor = (severity: FindingSeverity) => {
    return severityOptions.find((s) => s.value === severity)?.color || "";
  };

  // Toggle a single type
  const toggleType = (type: FindingType) => {
    const newTypes = selectedTypes.includes(type)
      ? selectedTypes.filter((t) => t !== type)
      : [...selectedTypes, type];

    if (newTypes.length === 0) {
      // Clear types filter
      const newFilters = { ...filters };
      delete newFilters.types;
      delete newFilters.type;
      onFiltersChange(newFilters);
    } else {
      onFiltersChange({ ...filters, types: newTypes, type: undefined });
    }
  };

  // Toggle all orphaned types
  const toggleOrphaned = () => {
    if (isOrphanedSelected) {
      // Remove all orphaned types
      const newTypes = selectedTypes.filter((t) => !ORPHANED_FINDING_TYPES.includes(t));
      if (newTypes.length === 0) {
        const newFilters = { ...filters };
        delete newFilters.types;
        delete newFilters.type;
        onFiltersChange(newFilters);
      } else {
        onFiltersChange({ ...filters, types: newTypes, type: undefined });
      }
    } else {
      // Add all orphaned types
      const newTypes = [...new Set([...selectedTypes, ...ORPHANED_FINDING_TYPES])];
      onFiltersChange({ ...filters, types: newTypes, type: undefined });
    }
  };

  // Toggle all types in a category
  const toggleCategory = (category: string) => {
    const categoryTypes = groupedTypes[category]?.map((t) => t.value) || [];
    const allSelected = categoryTypes.every((t) => selectedTypes.includes(t));

    if (allSelected) {
      // Remove all category types
      const newTypes = selectedTypes.filter((t) => !categoryTypes.includes(t));
      if (newTypes.length === 0) {
        const newFilters = { ...filters };
        delete newFilters.types;
        delete newFilters.type;
        onFiltersChange(newFilters);
      } else {
        onFiltersChange({ ...filters, types: newTypes, type: undefined });
      }
    } else {
      // Add all category types
      const newTypes = [...new Set([...selectedTypes, ...categoryTypes])];
      onFiltersChange({ ...filters, types: newTypes, type: undefined });
    }
  };

  // Clear all type filters
  const clearTypes = () => {
    const newFilters = { ...filters };
    delete newFilters.types;
    delete newFilters.type;
    onFiltersChange(newFilters);
    setTypePopoverOpen(false);
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

          {/* Type filter with multi-select */}
          <Popover open={typePopoverOpen} onOpenChange={setTypePopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={selectedTypes.length > 0 ? "bg-muted border-primary/50" : ""}
              >
                <SlidersHorizontal className="mr-2 h-4 w-4" />
                Types
                {selectedTypes.length > 0 && (
                  <Badge variant="secondary" className="ml-2 px-1.5 py-0 text-xs">
                    {selectedTypes.length}
                  </Badge>
                )}
                <ChevronDown className="ml-1 h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="start">
              <div className="p-3 border-b">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">Filter by Type</span>
                  {selectedTypes.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={clearTypes} className="h-7 px-2 text-xs">
                      Clear all
                    </Button>
                  )}
                </div>
              </div>

              {/* Quick preset: Orphaned Resources */}
              <div className="p-3 border-b bg-muted/30">
                <Checkbox
                  id="orphaned-preset"
                  checked={isOrphanedSelected}
                  onChange={toggleOrphaned}
                  label={
                    <div className="flex items-center gap-2">
                      <HardDrive className="h-4 w-4 text-orange-500" />
                      <span className="font-medium">Orphaned Resources</span>
                      <span className="text-xs text-muted-foreground">({ORPHANED_FINDING_TYPES.length} types)</span>
                    </div>
                  }
                />
              </div>

              {/* Types by category */}
              <div className="max-h-[300px] overflow-y-auto">
                {categoryOrder.map((category) => {
                  const types = groupedTypes[category];
                  if (!types) return null;
                  const allSelected = types.every((t) => selectedTypes.includes(t.value));
                  const someSelected = types.some((t) => selectedTypes.includes(t.value));

                  return (
                    <div key={category} className="border-b last:border-b-0">
                      {/* Category header with toggle all */}
                      <div
                        className="flex items-center gap-2 px-3 py-2 bg-muted/50 cursor-pointer hover:bg-muted"
                        onClick={() => toggleCategory(category)}
                      >
                        <div
                          className={`h-4 w-4 rounded border-2 flex items-center justify-center transition-colors ${
                            allSelected
                              ? "bg-primary border-primary"
                              : someSelected
                              ? "bg-primary/30 border-primary/50"
                              : "border-border"
                          }`}
                        >
                          {(allSelected || someSelected) && (
                            <svg className="h-3 w-3 text-primary-foreground" viewBox="0 0 12 12">
                              {allSelected ? (
                                <path
                                  d="M10 3L4.5 8.5 2 6"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  fill="none"
                                />
                              ) : (
                                <rect x="2" y="5" width="8" height="2" fill="currentColor" />
                              )}
                            </svg>
                          )}
                        </div>
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          {category}
                        </span>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {types.filter((t) => selectedTypes.includes(t.value)).length}/{types.length}
                        </span>
                      </div>

                      {/* Individual type checkboxes */}
                      <div className="px-3 py-2 space-y-2">
                        {types.map((type) => (
                          <Checkbox
                            key={type.value}
                            id={type.value}
                            checked={selectedTypes.includes(type.value)}
                            onChange={() => toggleType(type.value)}
                            label={<span className="text-sm">{type.label}</span>}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>

          {/* Quick orphaned toggle button */}
          <Button
            variant={isOrphanedSelected ? "default" : "outline"}
            size="default"
            onClick={toggleOrphaned}
            className={isOrphanedSelected ? "" : ""}
          >
            <HardDrive className="mr-2 h-4 w-4" />
            Orphaned
          </Button>

          {/* Quick non-trivial toggle button */}
          <Button
            variant={hideTrivial ? "default" : "outline"}
            size="default"
            onClick={() => updateSettings({ hideTrivial: !hideTrivial })}
          >
            <EyeOff className="mr-2 h-4 w-4" />
            Non-Trivial
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
        {(searchQuery || filters.severity || filters.status || selectedTypes.length > 0) && (
          <div className="flex flex-wrap gap-1.5 ml-2">
            {searchQuery && (
              <Badge variant="secondary" className="gap-1 pr-1">
                Search: "{searchQuery.length > 15 ? `${searchQuery.slice(0, 15)  }...` : searchQuery}"
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
            {selectedTypes.map((type) => (
              <Badge key={type} variant="secondary" className="gap-1 pr-1">
                {getTypeLabel(type)}
                <button
                  onClick={() => toggleType(type)}
                  className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
