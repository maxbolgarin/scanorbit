import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import type { FindingFilters as Filters, FindingType, FindingSeverity, FindingStatus } from "@/types";

interface FindingFiltersProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
}

const typeOptions: { value: FindingType; label: string }[] = [
  // Orphan findings
  { value: "orphaned_volume", label: "Orphaned Volume" },
  { value: "orphaned_eip", label: "Orphaned EIP" },
  { value: "orphaned_snapshot", label: "Orphaned Snapshot" },
  // SSL findings
  { value: "ssl_expiry", label: "SSL Expiry" },
  // Compliance findings
  { value: "data_residency_violation", label: "Data Residency" },
  // Security findings
  { value: "unencrypted_resource", label: "Unencrypted Resource" },
  { value: "public_access", label: "Public Access" },
  { value: "permissive_security_group", label: "Permissive Security Group" },
  { value: "open_all_ports", label: "Open All Ports" },
  // Cost findings
  { value: "unused_resource", label: "Unused Resource" },
  { value: "stopped_instance", label: "Stopped Instance" },
  { value: "unused_log_group", label: "Unused Log Group" },
  // Tagging findings
  { value: "missing_tag", label: "Missing Tag" },
  // IAM findings
  { value: "old_access_key", label: "Old Access Key" },
  { value: "unused_access_key", label: "Unused Access Key" },
  { value: "unused_iam_role", label: "Unused IAM Role" },
  { value: "user_without_mfa", label: "User Without MFA" },
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
  const hasFilters = filters.type || filters.severity || filters.status;

  const clearFilters = () => {
    onFiltersChange({});
  };

  return (
    <div className="flex flex-wrap gap-3">
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
