import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SeverityBadge } from "@/components/shared/SeverityBadge";
import { FindingStatusBadge } from "@/components/shared/StatusBadge";
import { formatRelativeTime, formatCurrency } from "@/lib/utils";
import type { Finding } from "@/types";
import { ChevronRight, DollarSign } from "lucide-react";

interface FindingsTableProps {
  findings: Finding[];
  onSelectFinding: (finding: Finding) => void;
}

const typeLabels: Record<string, string> = {
  // Orphan findings
  orphaned_volume: "Orphaned Volume",
  orphaned_eip: "Orphaned EIP",
  orphaned_snapshot: "Orphaned Snapshot",
  // SSL findings
  ssl_expiry: "SSL Expiry",
  // Compliance findings
  data_residency_violation: "Data Residency",
  // Security findings
  unencrypted_resource: "Unencrypted Resource",
  public_access: "Public Access",
  permissive_security_group: "Permissive Security Group",
  open_all_ports: "Open All Ports",
  // Cost findings
  unused_resource: "Unused Resource",
  stopped_instance: "Stopped Instance",
  unused_log_group: "Unused Log Group",
  // Tagging findings
  missing_tag: "Missing Tag",
  // IAM findings
  old_access_key: "Old Access Key",
  unused_access_key: "Unused Access Key",
  unused_iam_role: "Unused IAM Role",
  user_without_mfa: "User Without MFA",
};

export function FindingsTable({ findings, onSelectFinding }: FindingsTableProps) {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Severity</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="hidden md:table-cell">Summary</TableHead>
            <TableHead className="hidden lg:table-cell">Status</TableHead>
            <TableHead className="hidden lg:table-cell text-right">Savings</TableHead>
            <TableHead className="text-right">Detected</TableHead>
            <TableHead className="w-10"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {findings.map((finding) => (
            <TableRow
              key={finding.id}
              className="cursor-pointer"
              onClick={() => onSelectFinding(finding)}
            >
              <TableCell>
                <SeverityBadge severity={finding.severity} />
              </TableCell>
              <TableCell className="font-medium">
                {typeLabels[finding.type] || finding.type}
              </TableCell>
              <TableCell className="hidden max-w-[300px] truncate md:table-cell">
                {finding.summary}
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                <FindingStatusBadge status={finding.status} />
              </TableCell>
              <TableCell className="hidden lg:table-cell text-right">
                {typeof finding.details.estimatedSavings === "number" ? (
                  <span className="flex items-center justify-end gap-1 text-green-600">
                    <DollarSign className="h-3 w-3" />
                    {formatCurrency(finding.details.estimatedSavings)}
                  </span>
                ) : (
                  "-"
                )}
              </TableCell>
              <TableCell className="text-right text-muted-foreground">
                {formatRelativeTime(finding.createdAt)}
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
