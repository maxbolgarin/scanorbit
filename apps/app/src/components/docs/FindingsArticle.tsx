import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Shield, Key, FileCheck, DollarSign, Tag } from "lucide-react";
import type { FindingSeverity } from "@/types";

interface FindingInfo {
  type: string;
  severity: FindingSeverity | string;
  description: string;
  triggers: string[];
  remediation: string[];
}

const severityColors: Record<string, string> = {
  critical: "bg-red-900 text-red-100",
  high: "bg-red-600 text-white",
  medium: "bg-yellow-500 text-black",
  low: "bg-blue-500 text-white",
  trivial: "bg-gray-500 text-white",
};

function SeverityBadge({ severity }: { severity: string }) {
  const normalizedSeverity = severity.toLowerCase().split("/")[0].trim();
  return (
    <Badge className={severityColors[normalizedSeverity] || "bg-gray-500"}>
      {severity.toUpperCase()}
    </Badge>
  );
}

function FindingCard({ finding }: { finding: FindingInfo }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="mb-3">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isOpen ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
                <code className="text-sm font-mono bg-muted px-2 py-1 rounded">
                  {finding.type}
                </code>
              </div>
              <SeverityBadge severity={finding.severity} />
            </div>
            <CardDescription className="ml-7 mt-2">
              {finding.description}
            </CardDescription>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4">
            <div>
              <h4 className="text-sm font-semibold mb-2">Trigger Conditions</h4>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                {finding.triggers.map((trigger, i) => (
                  <li key={i}>{trigger}</li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-2">Remediation</h4>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                {finding.remediation.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function CategorySection({
  title,
  icon: Icon,
  findings,
  defaultOpen = false,
}: {
  title: string;
  icon: React.ElementType;
  findings: FindingInfo[];
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mb-6">
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-between p-4 h-auto hover:bg-muted/50"
        >
          <div className="flex items-center gap-3">
            <Icon className="h-5 w-5" />
            <span className="text-lg font-semibold">{title}</span>
            <Badge variant="secondary">{findings.length}</Badge>
          </div>
          {isOpen ? (
            <ChevronDown className="h-5 w-5" />
          ) : (
            <ChevronRight className="h-5 w-5" />
          )}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pt-2">
        {findings.map((finding) => (
          <FindingCard key={finding.type} finding={finding} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

// Finding data organized by category
const securityFindings: FindingInfo[] = [
  {
    type: "unencrypted_resource",
    severity: "Medium/High",
    description:
      "Detects resources that are not encrypted at rest, which could expose sensitive data if storage media is compromised.",
    triggers: [
      "EBS volume with encrypted: false",
      "RDS instance with storage_encrypted: false",
    ],
    remediation: [
      "EBS: Create an encrypted snapshot and restore to a new encrypted volume",
      "RDS: Create an encrypted snapshot and restore to a new encrypted instance (encryption must be enabled at creation time)",
    ],
  },
  {
    type: "public_access",
    severity: "High",
    description:
      "S3 bucket has Block Public Access settings disabled, potentially allowing unauthorized access to bucket contents.",
    triggers: [
      "Any of block_public_acls, ignore_public_acls, block_public_policy, or restrict_public_buckets is false",
    ],
    remediation: [
      "Enable all Block Public Access settings unless public access is explicitly required for the use case",
    ],
  },
  {
    type: "permissive_security_group",
    severity: "High",
    description:
      "Security group allows access to sensitive ports (SSH, RDP, databases) from the public internet (0.0.0.0/0).",
    triggers: [
      "Inbound rule allows traffic from 0.0.0.0/0 or ::/0",
      "Rule includes sensitive ports: 22 (SSH), 3389 (RDP), 3306 (MySQL), 5432 (PostgreSQL), 1433 (MSSQL), 27017 (MongoDB), 6379 (Redis), 9200 (Elasticsearch), 5672 (RabbitMQ), 11211 (Memcached)",
    ],
    remediation: [
      "Restrict access to specific IP ranges or use a VPN/bastion host for administrative access",
    ],
  },
  {
    type: "open_all_ports",
    severity: "High",
    description:
      "Security group allows all traffic (all ports) from the public internet.",
    triggers: [
      "Inbound rule with protocol -1 (all) open to 0.0.0.0/0 or ::/0",
      "Inbound rule with ports 0-65535 open to 0.0.0.0/0 or ::/0",
    ],
    remediation: [
      "Restrict inbound rules to only the specific ports and IP ranges required for your application",
    ],
  },
  {
    type: "publicly_accessible_rds",
    severity: "Critical",
    description:
      "RDS instance is configured to be publicly accessible from the internet.",
    triggers: ["RDS instance has publicly_accessible: true"],
    remediation: [
      "Disable public accessibility and access the database through a VPN, bastion host, or VPC peering",
    ],
  },
  {
    type: "public_snapshot",
    severity: "Critical",
    description:
      "EBS or RDS snapshot is shared publicly, potentially exposing sensitive data.",
    triggers: ["Snapshot permissions include 'all' (public)"],
    remediation: [
      "Remove public permissions from the snapshot",
      "If sharing is required, use specific AWS account IDs",
    ],
  },
  {
    type: "insecure_tls",
    severity: "Medium",
    description:
      "Resource is using outdated TLS versions (1.0/1.1) or weak cipher suites.",
    triggers: [
      "ALB or CloudFront using TLS policy that allows TLS 1.0 or 1.1",
      "Weak cipher suites configured",
    ],
    remediation: [
      "Update the security policy to use TLS 1.2 or higher with modern cipher suites",
    ],
  },
];

const iamFindings: FindingInfo[] = [
  {
    type: "user_without_mfa",
    severity: "High",
    description:
      "IAM user does not have Multi-Factor Authentication (MFA) enabled, increasing risk of unauthorized access.",
    triggers: ["IAM user with mfa_enabled: false"],
    remediation: [
      "Enable MFA for all IAM users, especially those with console access or administrative privileges",
    ],
  },
  {
    type: "old_access_key",
    severity: "Medium",
    description:
      "IAM access key is older than 90 days, exceeding AWS security best practice recommendations.",
    triggers: ["Access key created more than 90 days ago"],
    remediation: [
      "Rotate the access key by creating a new key, updating applications, and then deactivating/deleting the old key",
    ],
  },
  {
    type: "unused_access_key",
    severity: "Low",
    description:
      "IAM access key has not been used for an extended period or has never been used.",
    triggers: [
      "Active access key never used (after 7-day grace period)",
      "Active access key not used in 90+ days",
    ],
    remediation: [
      "Delete the access key if no longer needed. Unused active keys pose a security risk",
    ],
  },
  {
    type: "unused_iam_role",
    severity: "Low",
    description: "IAM role has not been assumed for an extended period.",
    triggers: [
      "Role created 90+ days ago and never used",
      "Role not used in 90+ days",
    ],
    remediation: [
      "Delete the role if no longer needed. Unused roles increase the attack surface",
    ],
  },
  {
    type: "root_account_usage",
    severity: "Critical",
    description:
      "AWS root account has been used recently or does not have MFA enabled.",
    triggers: [
      "Root account activity detected in recent CloudTrail logs",
      "Root account MFA not enabled",
    ],
    remediation: [
      "Enable MFA on the root account",
      "Create IAM users for day-to-day operations",
      "Use root only for tasks that require root privileges",
    ],
  },
  {
    type: "overly_permissive_policy",
    severity: "High",
    description:
      "IAM policy grants overly broad permissions (e.g., *:* or admin access).",
    triggers: [
      'Policy contains Action: "*" with Resource: "*"',
      "Policy grants AdministratorAccess",
    ],
    remediation: [
      "Apply the principle of least privilege. Grant only the specific permissions required",
    ],
  },
  {
    type: "cross_account_trust",
    severity: "High",
    description:
      "IAM role trusts external AWS accounts without proper conditions.",
    triggers: [
      "Role trust policy allows assumption from external accounts",
      "No Condition clause restricting external access",
    ],
    remediation: [
      "Add conditions to the trust policy (e.g., ExternalId, SourceArn, or SourceAccount) to prevent confused deputy attacks",
    ],
  },
];

const complianceFindings: FindingInfo[] = [
  {
    type: "ssl_expiry",
    severity: "Critical/Medium/Low",
    description:
      "SSL/TLS certificate is expiring soon or has already expired.",
    triggers: [
      "Certificate expires in less than 60 days",
      "Certificate has already expired",
    ],
    remediation: [
      "ACM certificates: Verify domain validation is working for auto-renewal",
      "Other certificates: Renew the certificate before expiration",
    ],
  },
  {
    type: "data_residency_violation",
    severity: "High",
    description:
      "Resource is located in a region that violates data residency requirements.",
    triggers: [
      "Resource exists in a non-approved region based on organization's data residency policy",
    ],
    remediation: [
      "Migrate the resource to an approved region or obtain necessary approvals for the current location",
    ],
  },
  {
    type: "cloudtrail_disabled",
    severity: "High",
    description:
      "CloudTrail logging is not enabled, preventing audit trail of AWS API calls.",
    triggers: [
      "No active CloudTrail trail in the account/region",
      "Trail exists but is not logging",
    ],
    remediation: [
      "Enable CloudTrail with multi-region logging and S3 log file validation",
    ],
  },
  {
    type: "vpc_flow_logs_disabled",
    severity: "Medium",
    description:
      "VPC Flow Logs are not configured, limiting network traffic visibility.",
    triggers: ["VPC has no associated flow log"],
    remediation: [
      "Enable VPC Flow Logs to capture network traffic for security analysis and troubleshooting",
    ],
  },
  {
    type: "backup_not_configured",
    severity: "Medium",
    description:
      "Critical resources do not have AWS Backup plans configured.",
    triggers: [
      "RDS instance, EBS volume, or other critical resource not included in any backup plan",
    ],
    remediation: [
      "Create an AWS Backup plan and add the resource to ensure regular backups",
    ],
  },
];

const costFindings: FindingInfo[] = [
  {
    type: "orphaned_volume",
    severity: "Medium",
    description:
      "EBS volume is not attached to any EC2 instance, incurring unnecessary storage costs.",
    triggers: ["EBS volume with state 'available' (not 'in-use')"],
    remediation: [
      "If data is needed, attach to an instance or create a snapshot",
      "Delete the volume if no longer needed",
    ],
  },
  {
    type: "orphaned_eip",
    severity: "Low",
    description: "Elastic IP address is not associated with any resource.",
    triggers: ["EIP not associated with an EC2 instance or NAT gateway"],
    remediation: [
      "Release the EIP if no longer needed. Unassociated EIPs incur hourly charges",
    ],
  },
  {
    type: "orphaned_snapshot",
    severity: "Low",
    description: "EBS snapshot's source volume no longer exists.",
    triggers: ["Snapshot references a volume ID that no longer exists"],
    remediation: [
      "Delete the snapshot if the data is no longer needed. Keep if it serves as a backup",
    ],
  },
  {
    type: "unused_resource",
    severity: "Low",
    description:
      "Resource (Lambda, Secret) hasn't been accessed or modified recently.",
    triggers: [
      "Lambda function not modified in 90+ days",
      "Secret not accessed in 90+ days",
    ],
    remediation: [
      "Review the resource and delete if no longer needed to reduce costs and attack surface",
    ],
  },
  {
    type: "stopped_instance",
    severity: "Low",
    description:
      "EC2 instance has been in stopped state for an extended period.",
    triggers: ["EC2 instance stopped for 7+ days"],
    remediation: [
      "If needed later: Create an AMI and terminate the instance",
      "If not needed: Terminate the instance",
      "Note: Stopped instances still incur EBS storage costs",
    ],
  },
  {
    type: "unused_log_group",
    severity: "Trivial",
    description:
      "CloudWatch Logs group has high storage usage with no retention policy.",
    triggers: [
      "Log group with 100+ MB stored",
      "Created 30+ days ago",
      "No retention policy configured",
    ],
    remediation: [
      "Set a retention policy to automatically delete old logs, or delete the log group if no longer needed",
    ],
  },
  {
    type: "idle_nat_gateway",
    severity: "Low",
    description:
      "NAT Gateway has minimal or no traffic but continues to incur hourly charges.",
    triggers: ["NAT Gateway with very low data processing metrics"],
    remediation: [
      "Consider using NAT instances for low-traffic scenarios, or consolidate NAT Gateways",
    ],
  },
  {
    type: "oversized_instance",
    severity: "Low",
    description:
      "EC2 instance is significantly underutilized based on CPU/memory metrics.",
    triggers: [
      "Average CPU utilization below 10% over extended period",
      "Memory utilization consistently low",
    ],
    remediation: [
      "Rightsize the instance to a smaller instance type that matches actual usage",
    ],
  },
];

const taggingFindings: FindingInfo[] = [
  {
    type: "missing_tag",
    severity: "Trivial",
    description: "Resource is missing required organizational tags.",
    triggers: [
      "Resource lacks one or more tags from the configured required tags list",
      "Default required tags: Environment, Owner, CostCenter",
    ],
    remediation: [
      "Add the missing tags to the resource. Proper tagging enables cost allocation, security policies, and resource management",
    ],
  },
];

export function FindingsArticle() {
  return (
    <div className="space-y-8">
      {/* Introduction */}
      <div>
        <h1 className="text-3xl font-bold mb-4">Findings Reference</h1>
        <p className="text-muted-foreground mb-6">
          ScanOrbit automatically detects security issues, compliance gaps, and
          cost optimization opportunities across your AWS infrastructure. This
          reference documents all finding types, their severity levels, and
          recommended remediation steps.
        </p>
      </div>

      {/* Severity Levels */}
      <Card>
        <CardHeader>
          <CardTitle>Severity Levels</CardTitle>
          <CardDescription>
            ScanOrbit uses a 5-tier severity system to help prioritize
            remediation efforts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">Severity</th>
                  <th className="text-left py-3 px-4">Description</th>
                  <th className="text-left py-3 px-4">Response Time</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-3 px-4">
                    <SeverityBadge severity="critical" />
                  </td>
                  <td className="py-3 px-4">
                    Active security breach risk, service disruption, or
                    compliance violation requiring immediate action
                  </td>
                  <td className="py-3 px-4 text-muted-foreground">
                    Immediate (hours)
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 px-4">
                    <SeverityBadge severity="high" />
                  </td>
                  <td className="py-3 px-4">
                    Serious security/compliance risk that could lead to breach
                    or significant impact
                  </td>
                  <td className="py-3 px-4 text-muted-foreground">
                    Within 24-48 hours
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 px-4">
                    <SeverityBadge severity="medium" />
                  </td>
                  <td className="py-3 px-4">
                    Important security or cost issue, should be addressed in
                    normal workflow
                  </td>
                  <td className="py-3 px-4 text-muted-foreground">
                    Within 1-2 weeks
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-3 px-4">
                    <SeverityBadge severity="low" />
                  </td>
                  <td className="py-3 px-4">
                    Best practice improvement, optimization opportunity
                  </td>
                  <td className="py-3 px-4 text-muted-foreground">
                    Within 1 month
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-4">
                    <SeverityBadge severity="trivial" />
                  </td>
                  <td className="py-3 px-4">
                    Nice to have, minimal impact, informational
                  </td>
                  <td className="py-3 px-4 text-muted-foreground">Optional</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Finding Categories */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">Finding Types by Category</h2>

        <CategorySection
          title="Security Findings"
          icon={Shield}
          findings={securityFindings}
          defaultOpen={true}
        />

        <CategorySection
          title="IAM Findings"
          icon={Key}
          findings={iamFindings}
        />

        <CategorySection
          title="Compliance Findings"
          icon={FileCheck}
          findings={complianceFindings}
        />

        <CategorySection
          title="Cost Optimization"
          icon={DollarSign}
          findings={costFindings}
        />

        <CategorySection
          title="Tagging Findings"
          icon={Tag}
          findings={taggingFindings}
        />
      </div>

      {/* Summary Table */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Reference</CardTitle>
          <CardDescription>
            All finding types with their default severity
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">Finding Type</th>
                  <th className="text-left py-3 px-4">Category</th>
                  <th className="text-left py-3 px-4">Severity</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { type: "ssl_expiry", category: "Compliance", severity: "Critical/Medium/Low" },
                  { type: "publicly_accessible_rds", category: "Security", severity: "Critical" },
                  { type: "public_snapshot", category: "Security", severity: "Critical" },
                  { type: "root_account_usage", category: "IAM", severity: "Critical" },
                  { type: "user_without_mfa", category: "IAM", severity: "High" },
                  { type: "public_access", category: "Security", severity: "High" },
                  { type: "permissive_security_group", category: "Security", severity: "High" },
                  { type: "open_all_ports", category: "Security", severity: "High" },
                  { type: "data_residency_violation", category: "Compliance", severity: "High" },
                  { type: "overly_permissive_policy", category: "IAM", severity: "High" },
                  { type: "cloudtrail_disabled", category: "Compliance", severity: "High" },
                  { type: "cross_account_trust", category: "IAM", severity: "High" },
                  { type: "unencrypted_resource", category: "Security", severity: "Medium/High" },
                  { type: "old_access_key", category: "IAM", severity: "Medium" },
                  { type: "orphaned_volume", category: "Cost", severity: "Medium" },
                  { type: "insecure_tls", category: "Security", severity: "Medium" },
                  { type: "vpc_flow_logs_disabled", category: "Compliance", severity: "Medium" },
                  { type: "backup_not_configured", category: "Compliance", severity: "Medium" },
                  { type: "orphaned_eip", category: "Cost", severity: "Low" },
                  { type: "orphaned_snapshot", category: "Cost", severity: "Low" },
                  { type: "unused_access_key", category: "IAM", severity: "Low" },
                  { type: "unused_iam_role", category: "IAM", severity: "Low" },
                  { type: "unused_resource", category: "Cost", severity: "Low" },
                  { type: "stopped_instance", category: "Cost", severity: "Low" },
                  { type: "idle_nat_gateway", category: "Cost", severity: "Low" },
                  { type: "oversized_instance", category: "Cost", severity: "Low" },
                  { type: "missing_tag", category: "Tagging", severity: "Trivial" },
                  { type: "unused_log_group", category: "Cost", severity: "Trivial" },
                ].map((item) => (
                  <tr key={item.type} className="border-b last:border-0">
                    <td className="py-2 px-4">
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                        {item.type}
                      </code>
                    </td>
                    <td className="py-2 px-4 text-muted-foreground">
                      {item.category}
                    </td>
                    <td className="py-2 px-4">
                      <SeverityBadge severity={item.severity} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
