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
import {
  ChevronDown,
  ChevronRight,
  Server,
  Database,
  HardDrive,
  Network,
  Key,
  Shield,
  Activity,
  Globe,
  MapPin,
  DollarSign,
} from "lucide-react";
import { ServiceIcon } from "@/components/shared/ServiceIcon";
import type { ServiceType } from "@/types";

interface ResourceInfo {
  service: ServiceType;
  name: string;
  description: string;
  dataCollected: string[];
  costModel: "Free" | "Paid";
  regionScope: "Global" | "Regional";
}

function ResourceCard({ resource }: { resource: ResourceInfo }) {
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
                <ServiceIcon service={resource.service} className="h-5 w-5" />
                <span className="font-medium">{resource.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant={resource.regionScope === "Global" ? "secondary" : "outline"}
                  className="text-xs"
                >
                  {resource.regionScope === "Global" ? (
                    <Globe className="h-3 w-3 mr-1" />
                  ) : (
                    <MapPin className="h-3 w-3 mr-1" />
                  )}
                  {resource.regionScope}
                </Badge>
                <Badge
                  variant={resource.costModel === "Free" ? "secondary" : "default"}
                  className="text-xs"
                >
                  <DollarSign className="h-3 w-3 mr-1" />
                  {resource.costModel}
                </Badge>
              </div>
            </div>
            <CardDescription className="ml-7 mt-2">
              {resource.description}
            </CardDescription>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <h4 className="text-sm font-semibold mb-2">Data Collected</h4>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              {resource.dataCollected.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function CategorySection({
  title,
  icon: Icon,
  resources,
  defaultOpen = false,
}: {
  title: string;
  icon: React.ElementType;
  resources: ResourceInfo[];
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
            <Badge variant="secondary">{resources.length}</Badge>
          </div>
          {isOpen ? (
            <ChevronDown className="h-5 w-5" />
          ) : (
            <ChevronRight className="h-5 w-5" />
          )}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pt-2">
        {resources.map((resource) => (
          <ResourceCard key={resource.service} resource={resource} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

// Resource data organized by category
const computeResources: ResourceInfo[] = [
  {
    service: "ec2",
    name: "EC2 Instances",
    description:
      "Virtual servers in the cloud. ScanOrbit tracks instance configurations, networking, and security settings.",
    dataCollected: [
      "Instance ID, Type, and Architecture (x86/ARM)",
      "AMI ID and Key Pair Name",
      "vCPU count, Core count, and Threads per Core",
      "Public/Private IP addresses and DNS names",
      "VPC, Subnet, and Security Group associations",
      "IAM Instance Profile (for dependency tracking)",
      "Block device mappings (attached EBS volumes)",
      "State (running/stopped/terminated)",
      "Launch time and monitoring status",
      "Tags and estimated monthly cost",
    ],
    costModel: "Paid",
    regionScope: "Regional",
  },
  {
    service: "lambda",
    name: "Lambda Functions",
    description:
      "Serverless compute functions. ScanOrbit monitors function configurations, runtimes, and resource allocations.",
    dataCollected: [
      "Function name and ARN",
      "Runtime (Python, Node.js, Java, Go, etc.)",
      "Handler and package type (Zip/Image)",
      "Memory size (MB) and timeout (seconds)",
      "Architecture (x86_64/arm64)",
      "Ephemeral storage configuration",
      "IAM execution role (for dependency tracking)",
      "VPC configuration (VPC, subnets, security groups)",
      "Lambda layers with ARNs and sizes",
      "KMS key ARN (if environment encrypted)",
      "State (Active/Pending/Inactive) and last modified date",
      "Tags",
    ],
    costModel: "Paid",
    regionScope: "Regional",
  },
];

const storageResources: ResourceInfo[] = [
  {
    service: "ebs",
    name: "EBS Volumes",
    description:
      "Block storage volumes for EC2 instances. ScanOrbit detects orphaned volumes and encryption status.",
    dataCollected: [
      "Volume ID, size (GB), and type (gp3, io2, st1, sc1)",
      "State (in-use/available) and availability zone",
      "Encryption status",
      "IOPS and throughput settings",
      "Attachments (which EC2 instances)",
      "Unattached timestamp (for orphan detection)",
      "Creation time and tags",
    ],
    costModel: "Paid",
    regionScope: "Regional",
  },
  {
    service: "s3",
    name: "S3 Buckets",
    description:
      "Object storage buckets. ScanOrbit tracks bucket locations and basic configuration.",
    dataCollected: [
      "Bucket name and ARN",
      "Region/location",
      "Creation date",
      "Default cost estimate",
    ],
    costModel: "Paid",
    regionScope: "Global",
  },
  {
    service: "rds_snapshot",
    name: "RDS Snapshots",
    description:
      "Database backup snapshots. ScanOrbit scans manual snapshots (automated snapshots excluded).",
    dataCollected: [
      "Snapshot identifier and ARN",
      "Source DB instance",
      "Allocated storage size",
      "Snapshot status",
      "Creation time",
      "Tags",
    ],
    costModel: "Paid",
    regionScope: "Regional",
  },
];

const databaseResources: ResourceInfo[] = [
  {
    service: "rds",
    name: "RDS Databases",
    description:
      "Managed relational databases. ScanOrbit monitors security, networking, and backup configurations.",
    dataCollected: [
      "DB instance identifier and class",
      "Engine (MySQL, PostgreSQL, Oracle, SQL Server, MariaDB) and version",
      "Allocated storage, type, and provisioned IOPS",
      "Encryption status",
      "Multi-AZ configuration",
      "Publicly accessible status",
      "VPC, subnet group, and security groups",
      "Backup retention period and windows",
      "Maintenance window and auto minor version upgrade",
      "Master username and database name",
      "Creation time, state, and tags",
    ],
    costModel: "Paid",
    regionScope: "Regional",
  },
];

const networkingResources: ResourceInfo[] = [
  {
    service: "alb",
    name: "Application Load Balancers",
    description:
      "Load balancers for distributing traffic. ScanOrbit tracks target groups and health status.",
    dataCollected: [
      "Load balancer ARN, name, and type",
      "Scheme (internet-facing/internal)",
      "VPC ID and availability zones",
      "DNS name and IP address type",
      "Security groups",
      "State (active/provisioning/failed)",
      "Target groups with ARNs and names",
      "Individual targets with health status",
      "Target type (instance/IP/lambda)",
      "Creation time and tags",
    ],
    costModel: "Paid",
    regionScope: "Regional",
  },
  {
    service: "eip",
    name: "Elastic IP Addresses",
    description:
      "Static public IP addresses. ScanOrbit detects unassociated EIPs that incur charges.",
    dataCollected: [
      "Allocation ID and public IP address",
      "Association status",
      "Associated instance or NAT gateway ID",
      "Tags",
    ],
    costModel: "Paid",
    regionScope: "Regional",
  },
  {
    service: "security_group",
    name: "Security Groups",
    description:
      "Virtual firewalls for EC2 instances. ScanOrbit analyzes inbound/outbound rules for security issues.",
    dataCollected: [
      "Group ID and name",
      "Description and VPC ID",
      "Inbound rules (protocol, ports, CIDR blocks, referenced groups)",
      "Outbound rules (same structure)",
      "Owner ID",
      "Tags",
    ],
    costModel: "Free",
    regionScope: "Regional",
  },
  {
    service: "acm",
    name: "ACM Certificates",
    description:
      "SSL/TLS certificates for secure connections. ScanOrbit monitors expiration dates.",
    dataCollected: [
      "Certificate ARN",
      "Primary domain and alternative names (SANs)",
      "Issuer and key algorithm",
      "Not before / not after dates (validity period)",
    ],
    costModel: "Paid",
    regionScope: "Regional",
  },
];

const iamResources: ResourceInfo[] = [
  {
    service: "iam_user",
    name: "IAM Users",
    description:
      "User accounts for AWS access. ScanOrbit checks MFA status and access patterns.",
    dataCollected: [
      "User name, ARN, and user ID",
      "Path",
      "Creation date",
      "Password last used (if available)",
      "MFA enabled status",
      "Tags",
    ],
    costModel: "Free",
    regionScope: "Global",
  },
  {
    service: "iam_role",
    name: "IAM Roles",
    description:
      "Roles for services and cross-account access. ScanOrbit tracks usage and trust relationships.",
    dataCollected: [
      "Role name, ARN, and role ID",
      "Path and description",
      "Max session duration",
      "Creation date",
      "Last used date and region (if available)",
      "Tags",
    ],
    costModel: "Free",
    regionScope: "Global",
  },
  {
    service: "iam_access_key",
    name: "IAM Access Keys",
    description:
      "API credentials for programmatic access. ScanOrbit monitors key age and usage.",
    dataCollected: [
      "Access key ID",
      "Associated user name",
      "Status (Active/Inactive)",
      "Creation date",
      "Last used date, service, and region (if available)",
    ],
    costModel: "Free",
    regionScope: "Global",
  },
  {
    service: "iam_policy",
    name: "IAM Policies",
    description:
      "Permission policies defining access rights. Referenced for permission analysis.",
    dataCollected: [
      "Policy ARN and name",
      "Path",
      "Policy document (for analysis)",
    ],
    costModel: "Free",
    regionScope: "Global",
  },
];

const managementResources: ResourceInfo[] = [
  {
    service: "cloudwatch_logs",
    name: "CloudWatch Log Groups",
    description:
      "Log storage and management. ScanOrbit tracks storage usage and retention policies.",
    dataCollected: [
      "Log group name and ARN",
      "Creation time",
      "Retention period (days)",
      "Stored bytes",
      "Metric filter count",
      "KMS key ID (if encrypted)",
      "Data protection status",
      "Tags",
    ],
    costModel: "Paid",
    regionScope: "Regional",
  },
  {
    service: "cloudwatch_alarm",
    name: "CloudWatch Alarms",
    description:
      "Metric monitoring alarms. ScanOrbit tracks alarm configurations and states.",
    dataCollected: [
      "Alarm name, ARN, and description",
      "State (ALARM/OK/INSUFFICIENT_DATA)",
      "State reason",
      "Metric name and namespace",
      "Statistic (Average/Sum/Max/Min)",
      "Period and evaluation periods",
      "Threshold and comparison operator",
      "Actions enabled status",
      "Tags",
    ],
    costModel: "Paid",
    regionScope: "Regional",
  },
  {
    service: "secret",
    name: "Secrets Manager Secrets",
    description:
      "Secure storage for credentials and API keys. ScanOrbit monitors access and rotation.",
    dataCollected: [
      "Secret name, ARN, and description",
      "KMS key ID",
      "Rotation enabled status",
      "Created, last accessed, last changed dates",
      "Last rotated and next rotation dates",
      "Primary region",
      "Deleted date (if scheduled)",
      "Tags",
    ],
    costModel: "Paid",
    regionScope: "Regional",
  },
];

const securityResources: ResourceInfo[] = [
  {
    service: "kms_key",
    name: "KMS Keys",
    description:
      "Encryption keys for data protection. ScanOrbit scans customer-managed keys (AWS-managed keys excluded).",
    dataCollected: [
      "Key ID, ARN, and description",
      "Key state (Enabled/Disabled/Pending)",
      "Key usage (ENCRYPT_DECRYPT/SIGN_VERIFY)",
      "Key spec (RSA/ECC/Symmetric)",
      "Origin (AWS_KMS/EXTERNAL)",
      "Key manager type (AWS/CUSTOMER)",
      "Creation date and enabled status",
      "Multi-region status",
      "Key rotation enabled",
      "Deletion date (if scheduled)",
      "Tags",
    ],
    costModel: "Paid",
    regionScope: "Regional",
  },
];

export function ResourcesArticle() {
  return (
    <div className="space-y-8">
      {/* Introduction */}
      <div>
        <h1 className="text-3xl font-bold mb-4">Scanned Resources</h1>
        <p className="text-muted-foreground mb-6">
          ScanOrbit automatically discovers and monitors AWS resources across
          your connected accounts. This reference documents all 18 resource
          types that are scanned, including what data is collected and how
          resources are categorized.
        </p>
      </div>

      {/* Scanning Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Scanning Overview</CardTitle>
          <CardDescription>
            How ScanOrbit discovers and tracks your AWS resources
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <h4 className="font-semibold flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Regional Resources
              </h4>
              <p className="text-sm text-muted-foreground">
                Scanned in parallel across all enabled AWS regions. Includes
                EC2, EBS, RDS, Lambda, ALB, CloudWatch, and more.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Global Resources
              </h4>
              <p className="text-sm text-muted-foreground">
                Scanned once per account. Includes S3 buckets and IAM resources
                (users, roles, access keys).
              </p>
            </div>
          </div>
          <div className="pt-2 border-t">
            <h4 className="font-semibold mb-2">Common Data Collected</h4>
            <p className="text-sm text-muted-foreground">
              For every resource, ScanOrbit captures: Resource ID/ARN, Name,
              Service Type, Region, State/Status, Tags, Raw AWS API response,
              Estimated Monthly Cost, and Last Seen timestamp.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Resource Categories */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">Resources by Category</h2>

        <CategorySection
          title="Compute"
          icon={Server}
          resources={computeResources}
          defaultOpen={true}
        />

        <CategorySection
          title="Storage"
          icon={HardDrive}
          resources={storageResources}
        />

        <CategorySection
          title="Database"
          icon={Database}
          resources={databaseResources}
        />

        <CategorySection
          title="Networking"
          icon={Network}
          resources={networkingResources}
        />

        <CategorySection
          title="Identity & Access Management"
          icon={Key}
          resources={iamResources}
        />

        <CategorySection
          title="Management & Monitoring"
          icon={Activity}
          resources={managementResources}
        />

        <CategorySection
          title="Security"
          icon={Shield}
          resources={securityResources}
        />
      </div>

      {/* Summary Table */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Reference</CardTitle>
          <CardDescription>
            All scanned resource types at a glance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">Resource</th>
                  <th className="text-left py-3 px-4">Category</th>
                  <th className="text-left py-3 px-4">Scope</th>
                  <th className="text-left py-3 px-4">Cost</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { name: "EC2 Instances", service: "ec2", category: "Compute", scope: "Regional", cost: "Paid" },
                  { name: "Lambda Functions", service: "lambda", category: "Compute", scope: "Regional", cost: "Paid" },
                  { name: "EBS Volumes", service: "ebs", category: "Storage", scope: "Regional", cost: "Paid" },
                  { name: "S3 Buckets", service: "s3", category: "Storage", scope: "Global", cost: "Paid" },
                  { name: "RDS Snapshots", service: "rds_snapshot", category: "Storage", scope: "Regional", cost: "Paid" },
                  { name: "RDS Databases", service: "rds", category: "Database", scope: "Regional", cost: "Paid" },
                  { name: "Load Balancers", service: "alb", category: "Networking", scope: "Regional", cost: "Paid" },
                  { name: "Elastic IPs", service: "eip", category: "Networking", scope: "Regional", cost: "Paid" },
                  { name: "Security Groups", service: "security_group", category: "Networking", scope: "Regional", cost: "Free" },
                  { name: "ACM Certificates", service: "acm", category: "Networking", scope: "Regional", cost: "Paid" },
                  { name: "IAM Users", service: "iam_user", category: "IAM", scope: "Global", cost: "Free" },
                  { name: "IAM Roles", service: "iam_role", category: "IAM", scope: "Global", cost: "Free" },
                  { name: "IAM Access Keys", service: "iam_access_key", category: "IAM", scope: "Global", cost: "Free" },
                  { name: "IAM Policies", service: "iam_policy", category: "IAM", scope: "Global", cost: "Free" },
                  { name: "CloudWatch Logs", service: "cloudwatch_logs", category: "Management", scope: "Regional", cost: "Paid" },
                  { name: "CloudWatch Alarms", service: "cloudwatch_alarm", category: "Management", scope: "Regional", cost: "Paid" },
                  { name: "Secrets Manager", service: "secret", category: "Management", scope: "Regional", cost: "Paid" },
                  { name: "KMS Keys", service: "kms_key", category: "Security", scope: "Regional", cost: "Paid" },
                ].map((item) => (
                  <tr key={item.service} className="border-b last:border-0">
                    <td className="py-2 px-4">
                      <div className="flex items-center gap-2">
                        <ServiceIcon
                          service={item.service as ServiceType}
                          className="h-4 w-4"
                        />
                        {item.name}
                      </div>
                    </td>
                    <td className="py-2 px-4 text-muted-foreground">
                      {item.category}
                    </td>
                    <td className="py-2 px-4">
                      <Badge variant="outline" className="text-xs">
                        {item.scope === "Global" ? (
                          <Globe className="h-3 w-3 mr-1" />
                        ) : (
                          <MapPin className="h-3 w-3 mr-1" />
                        )}
                        {item.scope}
                      </Badge>
                    </td>
                    <td className="py-2 px-4">
                      <Badge
                        variant={item.cost === "Free" ? "secondary" : "default"}
                        className="text-xs"
                      >
                        {item.cost}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Resource Dependencies */}
      <Card>
        <CardHeader>
          <CardTitle>Resource Dependencies</CardTitle>
          <CardDescription>
            ScanOrbit automatically tracks relationships between resources
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">Relationship</th>
                  <th className="text-left py-3 px-4">Source</th>
                  <th className="text-left py-3 px-4">Target</th>
                  <th className="text-left py-3 px-4">Example</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { type: "uses_role", source: "Lambda, EC2", target: "IAM Role", example: "Lambda function execution role" },
                  { type: "in_vpc", source: "EC2, RDS, Lambda", target: "VPC", example: "EC2 instance in VPC" },
                  { type: "in_subnet", source: "EC2, RDS, ENI", target: "Subnet", example: "RDS in private subnet" },
                  { type: "uses_sg", source: "EC2, RDS, Lambda", target: "Security Group", example: "EC2 security rules" },
                  { type: "attached_to", source: "EBS, ENI", target: "EC2", example: "Volume attached to instance" },
                  { type: "targets", source: "Target Group", target: "EC2, Lambda", example: "ALB targets" },
                  { type: "owns", source: "ALB", target: "Target Group", example: "Load balancer owns TG" },
                  { type: "uses_layer", source: "Lambda", target: "Lambda Layer", example: "Function uses shared code" },
                  { type: "encrypted_by", source: "EBS, RDS, S3", target: "KMS Key", example: "Volume encrypted by key" },
                ].map((item) => (
                  <tr key={item.type} className="border-b last:border-0">
                    <td className="py-2 px-4">
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                        {item.type}
                      </code>
                    </td>
                    <td className="py-2 px-4 text-muted-foreground">
                      {item.source}
                    </td>
                    <td className="py-2 px-4 text-muted-foreground">
                      {item.target}
                    </td>
                    <td className="py-2 px-4 text-muted-foreground">
                      {item.example}
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
