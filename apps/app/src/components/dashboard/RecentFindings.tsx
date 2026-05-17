import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SeverityBadge } from "@/components/shared/SeverityBadge";
import { formatRelativeTime } from "@/lib/utils";
import type { Finding } from "@/types";
import { ArrowRight, RefreshCw } from "lucide-react";

interface RecentFindingsProps {
  findings: Finding[];
  baseUrl?: string;
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
  permissive_security_group: "Permissive SG",
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

export function RecentFindings({ findings, baseUrl = "" }: RecentFindingsProps) {
  const navigate = useNavigate();

  const recentFindings = findings
    .filter((f) => f.status === "open")
    .slice(0, 5);

  const findingsPath = baseUrl ? `${baseUrl}/findings` : "/overview/findings";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Recent Findings</CardTitle>
          <CardDescription>Latest issues detected in your infrastructure</CardDescription>
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate(findingsPath)}>
          View all <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        {recentFindings.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            No open findings. Your infrastructure looks good!
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Severity</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="hidden md:table-cell">Summary</TableHead>
                <TableHead className="text-right">Detected</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentFindings.map((finding) => (
                <TableRow
                  key={finding.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`${findingsPath}?id=${finding.id}`)}
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
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {(finding.detectionCount || 1) > 1 && (
                        <span
                          className="flex items-center gap-0.5 text-xs text-status-warning"
                          title={`Detected ${finding.detectionCount} times`}
                        >
                          <RefreshCw className="h-3 w-3" />
                          {finding.detectionCount}
                        </span>
                      )}
                      <span className="text-muted-foreground">
                        {formatRelativeTime(finding.firstDetectedAt || finding.createdAt)}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
