import type {
  User,
  Org,
  AwsAccount,
  Resource,
  Certificate,
  Finding,
  Scan,
  DashboardSummary,
} from "@/types";

// Users
export const mockUser: User = {
  id: "user_1",
  email: "john@acmecorp.com",
  name: "John Smith",
  createdAt: "2024-01-15T10:00:00Z",
};

export const mockOrg: Org = {
  id: "org_1",
  name: "Acme Corp",
  createdAt: "2024-01-15T10:00:00Z",
};

// AWS Accounts
export const mockAwsAccounts: AwsAccount[] = [
  {
    id: "aws_1",
    orgId: "org_1",
    name: "Production",
    awsAccountId: "123456789012",
    roleArn: "arn:aws:iam::123456789012:role/ScanOrbitReadOnly",
    status: "ok",
    lastScanAt: "2024-12-20T14:30:00Z",
    createdAt: "2024-01-15T10:00:00Z",
    updatedAt: "2024-12-20T14:30:00Z",
  },
  {
    id: "aws_2",
    orgId: "org_1",
    name: "Staging",
    awsAccountId: "987654321098",
    roleArn: "arn:aws:iam::987654321098:role/ScanOrbitReadOnly",
    status: "ok",
    lastScanAt: "2024-12-19T09:15:00Z",
    createdAt: "2024-02-01T08:00:00Z",
    updatedAt: "2024-12-19T09:15:00Z",
  },
];

// Resources
export const mockResources: Resource[] = [
  // EC2 Instances
  {
    id: "res_1",
    orgId: "org_1",
    awsAccountId: "aws_1",
    region: "eu-west-1",
    service: "ec2",
    resourceId: "i-0abc123def456789",
    name: "api-server-prod-1",
    state: "running",
    tags: { Environment: "production", Team: "backend", App: "api" },
    costEstimateMonthly: 85,
    lastSeenAt: "2024-12-20T14:30:00Z",
  },
  {
    id: "res_2",
    orgId: "org_1",
    awsAccountId: "aws_1",
    region: "eu-west-1",
    service: "ec2",
    resourceId: "i-0def456abc789012",
    name: "api-server-prod-2",
    state: "running",
    tags: { Environment: "production", Team: "backend", App: "api" },
    costEstimateMonthly: 85,
    lastSeenAt: "2024-12-20T14:30:00Z",
  },
  {
    id: "res_3",
    orgId: "org_1",
    awsAccountId: "aws_1",
    region: "eu-central-1",
    service: "ec2",
    resourceId: "i-0ghi789jkl012345",
    name: "worker-node-1",
    state: "running",
    tags: { Environment: "production", Team: "data", App: "workers" },
    costEstimateMonthly: 120,
    lastSeenAt: "2024-12-20T14:30:00Z",
  },
  {
    id: "res_4",
    orgId: "org_1",
    awsAccountId: "aws_2",
    region: "eu-west-1",
    service: "ec2",
    resourceId: "i-0staging123456",
    name: "staging-server",
    state: "stopped",
    tags: { Environment: "staging", Team: "devops" },
    costEstimateMonthly: 0,
    lastSeenAt: "2024-12-19T09:15:00Z",
  },
  // EBS Volumes
  {
    id: "res_5",
    orgId: "org_1",
    awsAccountId: "aws_1",
    region: "eu-west-1",
    service: "ebs",
    resourceId: "vol-0abc123456789def0",
    name: "api-server-data",
    state: "in-use",
    tags: { Environment: "production", AttachedTo: "i-0abc123def456789" },
    costEstimateMonthly: 25,
    lastSeenAt: "2024-12-20T14:30:00Z",
  },
  {
    id: "res_6",
    orgId: "org_1",
    awsAccountId: "aws_1",
    region: "eu-west-1",
    service: "ebs",
    resourceId: "vol-0orphaned12345678",
    name: "old-backup-volume",
    state: "available",
    tags: { CreatedBy: "backup-script" },
    costEstimateMonthly: 15,
    lastSeenAt: "2024-12-20T14:30:00Z",
  },
  {
    id: "res_7",
    orgId: "org_1",
    awsAccountId: "aws_1",
    region: "eu-central-1",
    service: "ebs",
    resourceId: "vol-0orphaned87654321",
    name: "test-volume-unused",
    state: "available",
    tags: {},
    costEstimateMonthly: 8,
    lastSeenAt: "2024-12-20T14:30:00Z",
  },
  // RDS Instances
  {
    id: "res_8",
    orgId: "org_1",
    awsAccountId: "aws_1",
    region: "eu-west-1",
    service: "rds",
    resourceId: "acme-prod-db",
    name: "acme-prod-db",
    state: "available",
    tags: { Environment: "production", Team: "backend" },
    costEstimateMonthly: 350,
    lastSeenAt: "2024-12-20T14:30:00Z",
  },
  {
    id: "res_9",
    orgId: "org_1",
    awsAccountId: "aws_1",
    region: "us-east-1",
    service: "rds",
    resourceId: "analytics-db",
    name: "analytics-db",
    state: "available",
    tags: { Environment: "production", Team: "data" },
    costEstimateMonthly: 200,
    lastSeenAt: "2024-12-20T14:30:00Z",
  },
  // S3 Buckets
  {
    id: "res_10",
    orgId: "org_1",
    awsAccountId: "aws_1",
    region: "eu-west-1",
    service: "s3",
    resourceId: "acme-prod-assets",
    name: "acme-prod-assets",
    state: "active",
    tags: { Environment: "production", Purpose: "static-assets" },
    costEstimateMonthly: 45,
    lastSeenAt: "2024-12-20T14:30:00Z",
  },
  {
    id: "res_11",
    orgId: "org_1",
    awsAccountId: "aws_1",
    region: "us-west-2",
    service: "s3",
    resourceId: "acme-backups-us",
    name: "acme-backups-us",
    state: "active",
    tags: { Environment: "production", Purpose: "backups" },
    costEstimateMonthly: 120,
    lastSeenAt: "2024-12-20T14:30:00Z",
  },
  // ALB
  {
    id: "res_12",
    orgId: "org_1",
    awsAccountId: "aws_1",
    region: "eu-west-1",
    service: "alb",
    resourceId: "arn:aws:elasticloadbalancing:eu-west-1:123456789012:loadbalancer/app/api-lb/50dc6c495c0c9188",
    name: "api-lb",
    state: "active",
    tags: { Environment: "production", Team: "platform" },
    costEstimateMonthly: 35,
    lastSeenAt: "2024-12-20T14:30:00Z",
  },
  // EIP
  {
    id: "res_13",
    orgId: "org_1",
    awsAccountId: "aws_1",
    region: "eu-west-1",
    service: "eip",
    resourceId: "eipalloc-0abc123",
    name: "nat-gateway-ip",
    state: "in-use",
    tags: { Purpose: "nat-gateway" },
    costEstimateMonthly: 0,
    lastSeenAt: "2024-12-20T14:30:00Z",
  },
  {
    id: "res_14",
    orgId: "org_1",
    awsAccountId: "aws_1",
    region: "eu-west-1",
    service: "eip",
    resourceId: "eipalloc-0unused456",
    name: "unused-eip",
    state: "available",
    tags: {},
    costEstimateMonthly: 4,
    lastSeenAt: "2024-12-20T14:30:00Z",
  },
  // Snapshots
  {
    id: "res_15",
    orgId: "org_1",
    awsAccountId: "aws_1",
    region: "eu-west-1",
    service: "snapshot",
    resourceId: "snap-0old123456789",
    name: "old-backup-snap",
    state: "available",
    tags: { CreatedAt: "2024-01-15" },
    costEstimateMonthly: 3,
    lastSeenAt: "2024-12-20T14:30:00Z",
  },
];

// Certificates
export const mockCertificates: Certificate[] = [
  {
    id: "cert_1",
    orgId: "org_1",
    awsAccountId: "aws_1",
    source: "acm",
    identifier: "arn:aws:acm:eu-west-1:123456789012:certificate/abc123",
    primaryDomain: "api.acmecorp.com",
    altNames: ["api.acmecorp.com", "*.api.acmecorp.com"],
    notBefore: "2024-01-01T00:00:00Z",
    notAfter: "2025-01-01T00:00:00Z",
    issuer: "Amazon",
    lastSeenAt: "2024-12-20T14:30:00Z",
  },
  {
    id: "cert_2",
    orgId: "org_1",
    awsAccountId: "aws_1",
    source: "acm",
    identifier: "arn:aws:acm:eu-west-1:123456789012:certificate/def456",
    primaryDomain: "app.acmecorp.com",
    altNames: ["app.acmecorp.com"],
    notBefore: "2024-06-01T00:00:00Z",
    notAfter: "2025-01-05T00:00:00Z",
    issuer: "Amazon",
    lastSeenAt: "2024-12-20T14:30:00Z",
  },
  {
    id: "cert_3",
    orgId: "org_1",
    awsAccountId: "aws_1",
    source: "acm",
    identifier: "arn:aws:acm:eu-west-1:123456789012:certificate/ghi789",
    primaryDomain: "legacy.acmecorp.com",
    altNames: ["legacy.acmecorp.com"],
    notBefore: "2023-12-01T00:00:00Z",
    notAfter: "2024-12-25T00:00:00Z",
    issuer: "Let's Encrypt",
    lastSeenAt: "2024-12-20T14:30:00Z",
  },
];

// Findings
export const mockFindings: Finding[] = [
  {
    id: "find_1",
    orgId: "org_1",
    awsAccountId: "aws_1",
    resourceId: "res_6",
    type: "orphaned_volume",
    severity: "medium",
    status: "open",
    summary: "Orphaned EBS volume detected",
    details: {
      description: "EBS volume vol-0orphaned12345678 is not attached to any instance and has been available for over 30 days.",
      recommendation: "Delete this volume if the data is no longer needed, or attach it to an instance.",
      estimatedSavings: 15,
      region: "eu-west-1",
      awsConsoleUrl: "https://eu-west-1.console.aws.amazon.com/ec2/v2/home?region=eu-west-1#Volumes:volumeId=vol-0orphaned12345678",
    },
    createdAt: "2024-11-15T10:00:00Z",
  },
  {
    id: "find_2",
    orgId: "org_1",
    awsAccountId: "aws_1",
    resourceId: "res_7",
    type: "orphaned_volume",
    severity: "low",
    status: "open",
    summary: "Orphaned EBS volume detected",
    details: {
      description: "EBS volume vol-0orphaned87654321 is not attached to any instance.",
      recommendation: "Delete this volume if the data is no longer needed.",
      estimatedSavings: 8,
      region: "eu-central-1",
      awsConsoleUrl: "https://eu-central-1.console.aws.amazon.com/ec2/v2/home?region=eu-central-1#Volumes:volumeId=vol-0orphaned87654321",
    },
    createdAt: "2024-12-01T08:00:00Z",
  },
  {
    id: "find_3",
    orgId: "org_1",
    awsAccountId: "aws_1",
    resourceId: "res_14",
    type: "orphaned_eip",
    severity: "low",
    status: "open",
    summary: "Unassociated Elastic IP",
    details: {
      description: "Elastic IP eipalloc-0unused456 is not associated with any instance or network interface.",
      recommendation: "Release this Elastic IP if it's no longer needed to avoid charges.",
      estimatedSavings: 4,
      region: "eu-west-1",
      awsConsoleUrl: "https://eu-west-1.console.aws.amazon.com/ec2/v2/home?region=eu-west-1#Addresses:",
    },
    createdAt: "2024-12-10T12:00:00Z",
  },
  {
    id: "find_4",
    orgId: "org_1",
    awsAccountId: "aws_1",
    certificateId: "cert_3",
    type: "ssl_expiry",
    severity: "high",
    status: "open",
    summary: "SSL certificate expiring in 5 days",
    details: {
      description: "Certificate for legacy.acmecorp.com expires on December 25, 2024.",
      recommendation: "Renew or replace this certificate immediately to avoid service disruption.",
      expiresAt: "2024-12-25T00:00:00Z",
      awsConsoleUrl: "https://eu-west-1.console.aws.amazon.com/acm/home?region=eu-west-1#/certificates/list",
    },
    createdAt: "2024-12-18T00:00:00Z",
  },
  {
    id: "find_5",
    orgId: "org_1",
    awsAccountId: "aws_1",
    certificateId: "cert_1",
    type: "ssl_expiry",
    severity: "medium",
    status: "open",
    summary: "SSL certificate expiring in 12 days",
    details: {
      description: "Certificate for api.acmecorp.com expires on January 1, 2025.",
      recommendation: "Plan certificate renewal within the next week.",
      expiresAt: "2025-01-01T00:00:00Z",
      awsConsoleUrl: "https://eu-west-1.console.aws.amazon.com/acm/home?region=eu-west-1#/certificates/list",
    },
    createdAt: "2024-12-19T00:00:00Z",
  },
  {
    id: "find_6",
    orgId: "org_1",
    awsAccountId: "aws_1",
    resourceId: "res_9",
    type: "data_residency_violation",
    severity: "high",
    status: "open",
    summary: "RDS instance in non-EU region",
    details: {
      description: "RDS instance analytics-db is located in us-east-1, which may violate EU data residency requirements.",
      recommendation: "Review data stored in this database. Consider migrating to an EU region if it contains EU citizen data.",
      region: "us-east-1",
      awsConsoleUrl: "https://us-east-1.console.aws.amazon.com/rds/home?region=us-east-1#database:id=analytics-db",
    },
    createdAt: "2024-12-15T10:00:00Z",
  },
  {
    id: "find_7",
    orgId: "org_1",
    awsAccountId: "aws_1",
    resourceId: "res_11",
    type: "data_residency_violation",
    severity: "high",
    status: "open",
    summary: "S3 bucket in non-EU region",
    details: {
      description: "S3 bucket acme-backups-us is located in us-west-2, which may violate EU data residency requirements.",
      recommendation: "Review the contents of this bucket and migrate EU-related data to an EU region.",
      region: "us-west-2",
      awsConsoleUrl: "https://s3.console.aws.amazon.com/s3/buckets/acme-backups-us",
    },
    createdAt: "2024-12-15T10:00:00Z",
  },
  {
    id: "find_8",
    orgId: "org_1",
    awsAccountId: "aws_1",
    resourceId: "res_15",
    type: "orphaned_snapshot",
    severity: "low",
    status: "snoozed",
    summary: "Old EBS snapshot",
    details: {
      description: "EBS snapshot snap-0old123456789 is over 11 months old and may no longer be needed.",
      recommendation: "Delete old snapshots that are no longer required for backup purposes.",
      estimatedSavings: 3,
      region: "eu-west-1",
      awsConsoleUrl: "https://eu-west-1.console.aws.amazon.com/ec2/v2/home?region=eu-west-1#Snapshots:",
    },
    snoozedUntil: "2025-01-15T00:00:00Z",
    createdAt: "2024-12-01T08:00:00Z",
  },
  {
    id: "find_9",
    orgId: "org_1",
    awsAccountId: "aws_2",
    type: "orphaned_volume",
    severity: "low",
    status: "resolved",
    summary: "Orphaned EBS volume (resolved)",
    details: {
      description: "Previously orphaned volume was deleted.",
      recommendation: "No action needed.",
      estimatedSavings: 10,
      region: "eu-west-1",
    },
    resolvedAt: "2024-12-10T15:00:00Z",
    resolvedBy: "john@acmecorp.com",
    createdAt: "2024-11-01T08:00:00Z",
  },
];

// Scans
export const mockScans: Scan[] = [
  {
    id: "scan_1",
    awsAccountId: "aws_1",
    status: "completed",
    progress: 100,
    resourcesDiscovered: 15,
    findingsCount: 8,
    startedAt: "2024-12-20T14:00:00Z",
    completedAt: "2024-12-20T14:30:00Z",
  },
  {
    id: "scan_2",
    awsAccountId: "aws_1",
    status: "completed",
    progress: 100,
    resourcesDiscovered: 14,
    findingsCount: 7,
    startedAt: "2024-12-19T14:00:00Z",
    completedAt: "2024-12-19T14:25:00Z",
  },
  {
    id: "scan_3",
    awsAccountId: "aws_2",
    status: "completed",
    progress: 100,
    resourcesDiscovered: 5,
    findingsCount: 1,
    startedAt: "2024-12-19T09:00:00Z",
    completedAt: "2024-12-19T09:15:00Z",
  },
];

// Dashboard Summary
export const mockDashboardSummary: DashboardSummary = {
  totalResources: 15,
  resourcesTrend: 3,
  orphanedResources: 4,
  orphanedSavings: 30,
  expiringCertificates: 2,
  urgentCertificates: 1,
  residencyViolations: 2,
};

// Recommended Actions
export interface RecommendedAction {
  id: string;
  title: string;
  description: string;
  findingId?: string;
  resourceId?: string;
  priority: "high" | "medium" | "low";
  estimatedSavings?: number;
}

export const mockRecommendedActions: RecommendedAction[] = [
  {
    id: "action_1",
    title: "Renew SSL certificate for legacy.acmecorp.com",
    description: "Certificate expires in 5 days - renew immediately",
    findingId: "find_4",
    priority: "high",
  },
  {
    id: "action_2",
    title: "Delete orphaned EBS volumes",
    description: "2 volumes not attached to any instance",
    findingId: "find_1",
    priority: "medium",
    estimatedSavings: 23,
  },
  {
    id: "action_3",
    title: "Review data residency for analytics-db",
    description: "RDS instance in us-east-1 may contain EU data",
    findingId: "find_6",
    priority: "high",
  },
  {
    id: "action_4",
    title: "Release unused Elastic IP",
    description: "EIP not associated with any resource",
    findingId: "find_3",
    priority: "low",
    estimatedSavings: 4,
  },
];

// IAM Policy for AWS onboarding
export const iamTrustPolicy = `{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::SCANORBIT_ACCOUNT_ID:root"
      },
      "Action": "sts:AssumeRole",
      "Condition": {
        "StringEquals": {
          "sts:ExternalId": "YOUR_EXTERNAL_ID"
        }
      }
    }
  ]
}`;

export const iamPermissionPolicy = `{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ScanOrbitReadOnly",
      "Effect": "Allow",
      "Action": [
        "ec2:Describe*",
        "rds:Describe*",
        "s3:GetBucketLocation",
        "s3:GetBucketTagging",
        "s3:ListAllMyBuckets",
        "elasticloadbalancing:Describe*",
        "acm:DescribeCertificate",
        "acm:ListCertificates",
        "acm:ListTagsForCertificate",
        "sts:GetCallerIdentity"
      ],
      "Resource": "*"
    }
  ]
}`;
