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
import { ServiceIcon, getServiceLabel } from "@/components/shared/ServiceIcon";
import { formatCurrency, formatRelativeTime } from "@/lib/utils";
import type { Resource } from "@/types";
import { ChevronRight } from "lucide-react";

interface ResourcesTableProps {
  resources: Resource[];
}

const stateColors: Record<string, string> = {
  running: "success",
  active: "success",
  "in-use": "success",
  available: "warning",
  stopped: "secondary",
  inactive: "secondary",
};

export function ResourcesTable({ resources }: ResourcesTableProps) {
  const navigate = useNavigate();

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
            <TableHead className="w-10"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {resources.map((resource) => (
            <TableRow
              key={resource.id}
              className="cursor-pointer"
              onClick={() => navigate(`/resources/${resource.id}`)}
            >
              <TableCell>
                <div className="flex items-center gap-2">
                  <ServiceIcon service={resource.service} />
                  <span className="hidden sm:inline">
                    {getServiceLabel(resource.service)}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <div className="space-y-0.5">
                  <p className="font-medium">{resource.name}</p>
                  <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                    {resource.resourceId}
                  </p>
                </div>
              </TableCell>
              <TableCell className="hidden md:table-cell">
                {resource.region}
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                {resource.state ? (
                  <Badge
                    variant={
                      (stateColors[resource.state] as "success" | "warning" | "secondary") ||
                      "secondary"
                    }
                  >
                    {resource.state}
                  </Badge>
                ) : (
                  "-"
                )}
              </TableCell>
              <TableCell className="hidden lg:table-cell text-right">
                {resource.costEstimateMonthly
                  ? formatCurrency(parseFloat(resource.costEstimateMonthly))
                  : "-"}
              </TableCell>
              <TableCell className="hidden md:table-cell text-right text-muted-foreground">
                {formatRelativeTime(resource.lastSeenAt)}
              </TableCell>
              <TableCell>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
