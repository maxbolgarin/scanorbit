import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";
import type { FindingFilters as Filters, FindingType, FindingSeverity, FindingStatus } from "@/types";

interface FindingFiltersProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
}

const typeOptions: { value: FindingType; label: string }[] = [
  { value: "orphaned_volume", label: "Orphaned Volume" },
  { value: "orphaned_eip", label: "Orphaned EIP" },
  { value: "orphaned_snapshot", label: "Orphaned Snapshot" },
  { value: "ssl_expiry", label: "SSL Expiry" },
  { value: "data_residency_violation", label: "Data Residency" },
];

const severityOptions: { value: FindingSeverity; label: string }[] = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const statusOptions: { value: FindingStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "resolved", label: "Resolved" },
  { value: "snoozed", label: "Snoozed" },
  { value: "ignored", label: "Ignored" },
];

export function FindingFilters({ filters, onFiltersChange }: FindingFiltersProps) {
  const hasFilters = filters.type || filters.severity || filters.status || filters.search;

  const clearFilters = () => {
    onFiltersChange({});
  };

  return (
    <div className="flex flex-wrap gap-3">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search findings..."
          value={filters.search || ""}
          onChange={(e) =>
            onFiltersChange({ ...filters, search: e.target.value || undefined })
          }
          className="pl-9"
        />
      </div>

      <Select
        value={filters.type || "all"}
        onValueChange={(value) =>
          onFiltersChange({
            ...filters,
            type: value === "all" ? undefined : (value as FindingType),
          })
        }
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="All Types" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Types</SelectItem>
          {typeOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.severity || "all"}
        onValueChange={(value) =>
          onFiltersChange({
            ...filters,
            severity: value === "all" ? undefined : (value as FindingSeverity),
          })
        }
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="All Severities" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Severities</SelectItem>
          {severityOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.status || "all"}
        onValueChange={(value) =>
          onFiltersChange({
            ...filters,
            status: value === "all" ? undefined : (value as FindingStatus),
          })
        }
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="All Status" />
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

      {hasFilters && (
        <Button variant="ghost" size="icon" onClick={clearFilters}>
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
