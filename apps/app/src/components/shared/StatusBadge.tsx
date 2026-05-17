import { memo } from "react";
import { Badge } from "@/components/ui/badge";
import type { FindingStatus, AwsAccountStatus } from "@/types";

interface FindingStatusBadgeProps {
  status: FindingStatus;
}

const findingStatusConfig = {
  open: {
    variant: "destructive" as const,
    label: "Open",
  },
  resolved: {
    variant: "success" as const,
    label: "Resolved",
  },
  snoozed: {
    variant: "warning" as const,
    label: "Snoozed",
  },
  ignored: {
    variant: "secondary" as const,
    label: "Ignored",
  },
};

export const FindingStatusBadge = memo(function FindingStatusBadge({ status }: FindingStatusBadgeProps) {
  const config = findingStatusConfig[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
});

interface AccountStatusBadgeProps {
  status: AwsAccountStatus;
}

const accountStatusConfig = {
  ok: {
    variant: "success" as const,
    label: "Connected",
  },
  pending: {
    variant: "warning" as const,
    label: "Pending",
  },
  error: {
    variant: "error" as const,
    label: "Error",
  },
};

export const AccountStatusBadge = memo(function AccountStatusBadge({ status }: AccountStatusBadgeProps) {
  const config = accountStatusConfig[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
});
