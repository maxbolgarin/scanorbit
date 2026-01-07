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
import type { ResourceFilters as Filters, ServiceType } from "@/types";

interface ResourceFiltersProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  regions: string[];
  services: ServiceType[];
}

const serviceLabels: Record<ServiceType, string> = {
  ec2: "EC2 Instances",
  ebs: "EBS Volumes",
  rds: "RDS Databases",
  s3: "S3 Buckets",
  alb: "Load Balancers",
  acm: "Certificates",
  eip: "Elastic IPs",
  snapshot: "Snapshots",
};

export function ResourceFilters({
  filters,
  onFiltersChange,
  regions,
  services,
}: ResourceFiltersProps) {
  const hasFilters = filters.service || filters.region || filters.search;

  const clearFilters = () => {
    onFiltersChange({});
  };

  return (
    <div className="flex flex-wrap gap-3">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search resources..."
          value={filters.search || ""}
          onChange={(e) =>
            onFiltersChange({ ...filters, search: e.target.value || undefined })
          }
          className="pl-9"
        />
      </div>

      <Select
        value={filters.service || "all"}
        onValueChange={(value) =>
          onFiltersChange({
            ...filters,
            service: value === "all" ? undefined : (value as ServiceType),
          })
        }
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="All Services" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Services</SelectItem>
          {services.map((service) => (
            <SelectItem key={service} value={service}>
              {serviceLabels[service] || service.toUpperCase()}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.region || "all"}
        onValueChange={(value) =>
          onFiltersChange({
            ...filters,
            region: value === "all" ? undefined : value,
          })
        }
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="All Regions" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Regions</SelectItem>
          {regions.map((region) => (
            <SelectItem key={region} value={region}>
              {region}
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
