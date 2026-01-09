import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
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
  eip: "Elastic IPs",
  rds: "RDS Databases",
  rds_snapshot: "RDS Snapshots",
  s3: "S3 Buckets",
  alb: "Load Balancers",
  acm: "Certificates",
  lambda: "Lambda Functions",
  cloudwatch_logs: "CloudWatch Logs",
  cloudwatch_alarm: "CloudWatch Alarms",
  iam_user: "IAM Users",
  iam_role: "IAM Roles",
  iam_policy: "IAM Policies",
  iam_access_key: "Access Keys",
  security_group: "Security Groups",
  secret: "Secrets",
  kms_key: "KMS Keys",
};

export function ResourceFilters({
  filters,
  onFiltersChange,
  regions,
  services,
}: ResourceFiltersProps) {
  const hasFilters = filters.service || filters.region;

  const clearFilters = () => {
    onFiltersChange({});
  };

  return (
    <div className="flex flex-wrap gap-3">
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
