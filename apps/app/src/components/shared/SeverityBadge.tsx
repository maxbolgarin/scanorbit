import { Badge } from "@/components/ui/badge";
import type { FindingSeverity } from "@/types";

interface SeverityBadgeProps {
  severity: FindingSeverity;
}

const severityConfig = {
  high: {
    variant: "error" as const,
    label: "High",
  },
  medium: {
    variant: "warning" as const,
    label: "Medium",
  },
  low: {
    variant: "secondary" as const,
    label: "Low",
  },
};

export function SeverityBadge({ severity }: SeverityBadgeProps) {
  const config = severityConfig[severity];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
