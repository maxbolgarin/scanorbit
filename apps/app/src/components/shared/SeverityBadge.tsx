import { memo } from "react";
import { Badge } from "@/components/ui/badge";
import type { FindingSeverity } from "@/types";

interface SeverityBadgeProps {
  severity: FindingSeverity;
}

const severityConfig: Record<FindingSeverity, { variant: "destructive" | "error" | "warning" | "secondary" | "outline"; label: string }> = {
  critical: {
    variant: "destructive",
    label: "Critical",
  },
  high: {
    variant: "error",
    label: "High",
  },
  medium: {
    variant: "warning",
    label: "Medium",
  },
  low: {
    variant: "secondary",
    label: "Low",
  },
  trivial: {
    variant: "outline",
    label: "Trivial",
  },
};

export const SeverityBadge = memo(function SeverityBadge({ severity }: SeverityBadgeProps) {
  const config = severityConfig[severity];
  return <Badge variant={config.variant}>{config.label}</Badge>;
});
