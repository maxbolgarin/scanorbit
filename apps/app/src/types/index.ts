// User & Organization
export interface User {
  id: string;
  email: string;
  fullName: string | null;
  emailVerified?: boolean;
  twoFactorEnabled?: boolean;
  hasPassword?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Org {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  tier: SubscriptionTier;
  tierUpgradedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// Subscription Tiers
// =============================================================================

export type SubscriptionTier = 'free' | 'pro' | 'team';

export interface TierLimits {
  scanCooldownMinutes: number | null;
  canViewResourceList: boolean;
  canViewFindingList: boolean;
  canViewInfrastructureMap: boolean;
  allowRetryOnError: boolean;
  maxAccounts: number; // -1 = unlimited
  canViewOrgOverview: boolean;
  scanPriority: boolean;
  canExportData: boolean;
  canViewAuditLogs: boolean;
  canInviteMembers: boolean;
  canConfigureWebhooks: boolean;
}

export const TIER_LIMITS: Record<SubscriptionTier, TierLimits> = {
  free: {
    scanCooldownMinutes: null,
    canViewResourceList: false,
    canViewFindingList: false,
    canViewInfrastructureMap: false,
    allowRetryOnError: true,
    maxAccounts: 1,
    canViewOrgOverview: false,
    scanPriority: false,
    canExportData: false,
    canViewAuditLogs: false,
    canInviteMembers: false,
    canConfigureWebhooks: false,
  },
  pro: {
    scanCooldownMinutes: 60,
    canViewResourceList: true,
    canViewFindingList: true,
    canViewInfrastructureMap: true,
    allowRetryOnError: true,
    maxAccounts: 1,
    canViewOrgOverview: false,
    scanPriority: false,
    canExportData: false,
    canViewAuditLogs: false,
    canInviteMembers: false,
    canConfigureWebhooks: false,
  },
  team: {
    scanCooldownMinutes: null,
    canViewResourceList: true,
    canViewFindingList: true,
    canViewInfrastructureMap: true,
    allowRetryOnError: true,
    maxAccounts: -1, // unlimited
    canViewOrgOverview: true,
    scanPriority: true,
    canExportData: true,
    canViewAuditLogs: true,
    canInviteMembers: true,
    canConfigureWebhooks: true,
  },
};

export interface SubscriptionStatus {
  tier: SubscriptionTier;
  tierUpgradedAt: string | null;
  limits: TierLimits;
  scanStatus: {
    canScan: boolean;
    reason?: string;
    cooldownEndsAt?: string;
  };
  // Stripe subscription fields
  subscriptionStatus: 'none' | 'trialing' | 'active' | 'canceled' | 'past_due' | 'unpaid';
  trialEndsAt: string | null;
  subscriptionEndsAt: string | null;
  hasPaymentMethod: boolean;
  // Whether Stripe is configured and enabled
  stripeEnabled: boolean;
}


export interface CheckoutSession {
  sessionId: string;
  url: string;
}

export interface PortalSession {
  url: string;
}

// Organization viewing settings (global filters)
export interface OrgSettings {
  requiredTags: string[];
  hiddenFindingTypes: FindingType[];
  hideTrivial: boolean;
}

export interface OrgMember {
  id: string;
  userId: string;
  orgId: string;
  role: "admin" | "member";
  createdAt: string;
  user?: User;
}

export interface OrgInvitation {
  id: string;
  orgId: string;
  email: string;
  role: "admin" | "member";
  invitedBy: string | null;
  inviterName: string | null;
  status: "pending" | "accepted" | "canceled" | "expired";
  expiresAt: string;
  createdAt: string;
}

export interface SeatInfo {
  totalMembers: number;
  pendingInvitations: number;
  includedSeats: number;
  paidSeats: number;
  seatPriceMonthly: number;
}

export interface SeatBillingPreview {
  willAddPaidSeat: boolean;
  currentPaidSeats: number;
  newPaidSeats: number;
  seatPriceMonthly: number;
  estimatedNewMonthly: number;
}

export interface InviteInfo {
  orgName: string;
  inviterName: string;
  email: string;
  expiresAt: string;
}

// AWS Account
export type AwsAccountStatus = "pending" | "ok" | "error";

// Scanner Types
export type ScannerType =
  | "ec2"
  | "rds"
  | "s3"
  | "alb"
  | "acm"
  | "lambda"
  | "cloudwatch"
  | "iam"
  | "security_groups"
  | "secrets_manager"
  | "kms";

export const ALL_SCANNER_TYPES: ScannerType[] = [
  "ec2",
  "rds",
  "s3",
  "alb",
  "acm",
  "lambda",
  "cloudwatch",
  "iam",
  "security_groups",
  "secrets_manager",
  "kms",
];

// Permission categories for scanner selection UI
export interface PermissionCategory {
  id: string;
  label: string;
  description: string;
  scanners: ScannerType[];
  iamActions: string[];
}

export const PERMISSION_CATEGORIES: PermissionCategory[] = [
  {
    id: "ec2_compute",
    label: "EC2 & Compute",
    description: "EC2 instances, EBS volumes, EIPs, ENIs, NAT Gateways, Security Groups",
    scanners: ["ec2", "security_groups"],
    iamActions: [
      "ec2:DescribeInstances",
      "ec2:DescribeVolumes",
      "ec2:DescribeAddresses",
      "ec2:DescribeNetworkInterfaces",
      "ec2:DescribeNatGateways",
      "ec2:DescribeSecurityGroups",
      "ec2:DescribeSecurityGroupRules",
      "ec2:DescribeRegions",
    ],
  },
  {
    id: "database",
    label: "Database",
    description: "RDS instances and snapshots",
    scanners: ["rds"],
    iamActions: [
      "rds:DescribeDBInstances",
      "rds:DescribeDBSnapshots",
      "rds:ListTagsForResource",
    ],
  },
  {
    id: "storage",
    label: "Storage",
    description: "S3 buckets and policies",
    scanners: ["s3"],
    iamActions: [
      "s3:ListAllMyBuckets",
      "s3:GetBucketLocation",
      "s3:GetBucketTagging",
      "s3:GetBucketPolicy",
      "s3:GetBucketPolicyStatus",
      "s3:GetPublicAccessBlock",
    ],
  },
  {
    id: "networking",
    label: "Load Balancing",
    description: "Application/Network Load Balancers and Target Groups",
    scanners: ["alb"],
    iamActions: [
      "elasticloadbalancing:DescribeLoadBalancers",
      "elasticloadbalancing:DescribeTargetGroups",
      "elasticloadbalancing:DescribeTags",
    ],
  },
  {
    id: "certificates",
    label: "Certificates",
    description: "ACM SSL/TLS certificates",
    scanners: ["acm"],
    iamActions: [
      "acm:ListCertificates",
      "acm:DescribeCertificate",
      "acm:ListTagsForCertificate",
    ],
  },
  {
    id: "serverless",
    label: "Serverless",
    description: "Lambda functions",
    scanners: ["lambda"],
    iamActions: [
      "lambda:ListFunctions",
      "lambda:GetFunction",
      "lambda:ListTags",
    ],
  },
  {
    id: "monitoring",
    label: "Monitoring",
    description: "CloudWatch Log Groups and Alarms",
    scanners: ["cloudwatch"],
    iamActions: [
      "logs:DescribeLogGroups",
      "logs:ListTagsForResource",
      "cloudwatch:DescribeAlarms",
      "cloudwatch:ListTagsForResource",
    ],
  },
  {
    id: "identity",
    label: "Identity & Access",
    description: "IAM Users, Roles, and Access Keys",
    scanners: ["iam"],
    iamActions: [
      "iam:ListUsers",
      "iam:ListUserTags",
      "iam:ListMFADevices",
      "iam:ListRoles",
      "iam:ListRoleTags",
      "iam:GetRole",
      "iam:ListAccessKeys",
      "iam:GetAccessKeyLastUsed",
      "iam:ListAttachedRolePolicies",
      "iam:ListRolePolicies",
      "iam:GetRolePolicy",
    ],
  },
  {
    id: "secrets",
    label: "Secrets & Encryption",
    description: "Secrets Manager secrets and KMS keys",
    scanners: ["secrets_manager", "kms"],
    iamActions: [
      "secretsmanager:ListSecrets",
      "secretsmanager:DescribeSecret",
      "kms:ListKeys",
      "kms:DescribeKey",
      "kms:ListResourceTags",
      "kms:GetKeyRotationStatus",
    ],
  },
];

// Helper to generate IAM policy from selected categories
export function generateIAMPolicy(selectedCategories: string[]): string {
  const actions: string[] = [];

  PERMISSION_CATEGORIES.forEach((category) => {
    if (selectedCategories.includes(category.id)) {
      actions.push(...category.iamActions);
    }
  });

  // Deduplicate actions
  const uniqueActions = [...new Set(actions)];

  const policy = {
    Version: "2012-10-17",
    Statement: [
      {
        Sid: "ScanOrbitReadAccess",
        Effect: "Allow",
        Action: uniqueActions,
        Resource: "*",
      },
    ],
  };

  return JSON.stringify(policy, null, 2);
}

// Get scanners from selected categories
export function getScannersFromCategories(selectedCategories: string[]): ScannerType[] {
  const scanners: ScannerType[] = [];

  PERMISSION_CATEGORIES.forEach((category) => {
    if (selectedCategories.includes(category.id)) {
      scanners.push(...category.scanners);
    }
  });

  return [...new Set(scanners)];
}

// Get categories from enabled scanners (reverse mapping)
export function getCategoriesFromScanners(enabledScanners: ScannerType[]): string[] {
  return PERMISSION_CATEGORIES
    .filter((category) => category.scanners.every((s) => enabledScanners.includes(s)))
    .map((category) => category.id);
}

export interface AwsAccount {
  id: string;
  orgId: string;
  name: string;
  awsAccountId: string;
  roleArn: string;
  externalId: string | null;
  status: AwsAccountStatus;
  lastError: string | null;
  lastScanAt: string | null;
  enabledScanners: ScannerType[];
  createdAt: string;
  updatedAt: string;
}

// Resources
export type ServiceType =
  | "ec2"
  | "ebs"
  | "eip"
  | "rds"
  | "rds_snapshot"
  | "s3"
  | "alb"
  | "acm"
  | "lambda"
  | "cloudwatch_logs"
  | "cloudwatch_alarm"
  | "iam_user"
  | "iam_role"
  | "iam_policy"
  | "iam_access_key"
  | "security_group"
  | "secret"
  | "kms_key"
  | "eni"
  | "nat_gateway";

// Free services (no direct monthly cost)
export const FREE_SERVICES: ServiceType[] = [
  "iam_user",
  "iam_role",
  "iam_policy",
  "iam_access_key",
  "security_group",
  "eni",
];

// Paid services (incur direct costs)
export const PAID_SERVICES: ServiceType[] = [
  "ec2",
  "ebs",
  "eip",
  "rds",
  "rds_snapshot",
  "s3",
  "alb",
  "acm",
  "lambda",
  "cloudwatch_logs",
  "cloudwatch_alarm",
  "secret",
  "kms_key",
  "nat_gateway",
];

export type CostFilterType = "all" | "paid" | "free";

export type ResourceState = "running" | "stopped" | "available" | "in-use" | "active" | "inactive";

export interface Resource {
  id: string;
  orgId: string;
  awsAccountId: string;
  resourceId: string;
  service: ServiceType;
  region: string | null;
  name: string | null;
  state: string | null;
  tags: Record<string, string>;
  costEstimateMonthly: string | null;
  lastSeenAt: string;
  raw: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  // Joined fields
  awsAccount?: AwsAccount;
}

// Certificates
export type CertificateSource = "acm" | "endpoint_scan";

export interface Certificate {
  id: string;
  orgId: string;
  awsAccountId: string;
  identifier: string;
  source: CertificateSource;
  primaryDomain: string | null;
  altNames: string[];
  notBefore: string | null;
  notAfter: string | null;
  issuer: string | null;
  algorithm: string | null;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
}

// Findings
export type FindingType =
  // Orphan findings
  | "orphaned_volume"
  | "orphaned_eip"
  | "orphaned_snapshot"
  | "orphaned_eni"
  | "idle_load_balancer"
  | "unused_security_group"
  // SSL findings
  | "ssl_expiry"
  // Compliance findings
  | "data_residency_violation"
  | "cloudtrail_disabled"
  | "vpc_flow_logs_disabled"
  | "backup_not_configured"
  // Security findings
  | "unencrypted_resource"
  | "public_access"
  | "permissive_security_group"
  | "open_all_ports"
  | "publicly_accessible_rds"
  | "public_snapshot"
  | "insecure_tls"
  // Cost findings
  | "unused_resource"
  | "stopped_instance"
  | "unused_log_group"
  | "idle_nat_gateway"
  | "oversized_instance"
  // Cost optimization findings
  | "ebs_optimization"
  | "old_gen_instance"
  | "oversized_lambda"
  | "log_retention"
  | "unused_kms_key"
  | "rds_optimization"
  | "old_gen_rds"
  // Tagging findings
  | "missing_tag"
  // IAM findings
  | "old_access_key"
  | "unused_access_key"
  | "unused_iam_role"
  | "user_without_mfa"
  | "root_account_usage"
  | "overly_permissive_policy"
  | "cross_account_trust";

export type FindingSeverity = "critical" | "high" | "medium" | "low" | "trivial";

// Orphaned/unused resource finding types (for dashboard click-through)
export const ORPHANED_FINDING_TYPES: FindingType[] = [
  "orphaned_volume",
  "orphaned_eip",
  "orphaned_snapshot",
  "orphaned_eni",
  "idle_load_balancer",
  "idle_nat_gateway",
  "unused_security_group",
];

export type FindingStatus = "open" | "resolved" | "snoozed" | "ignored";

export interface Finding {
  id: string;
  orgId: string;
  awsAccountId: string;
  resourceId: string | null;
  certificateId: string | null;
  type: FindingType;
  severity: FindingSeverity;
  status: FindingStatus;
  summary: string;
  details: Record<string, unknown>;
  resolvedAt: string | null;
  snoozedUntil: string | null;
  // Lifecycle tracking fields
  firstDetectedAt: string | null;
  lastDetectedAt: string | null;
  detectionCount: number;
  lastScanId: string | null;
  createdAt: string;
  updatedAt: string;
  // Joined fields
  resource?: Resource;
  certificate?: Certificate;
  awsAccount?: AwsAccount;
}

// Scans
export type ScanStatus =
  | "queued"
  | "processing"
  | "running"
  | "analyzing"
  | "complete"
  | "partial"
  | "error"
  | "canceled";

// Active scan statuses (in progress)
export const ACTIVE_SCAN_STATUSES: ScanStatus[] = [
  "queued",
  "processing",
  "running",
  "analyzing",
];

export interface Scan {
  id: string;
  orgId: string;
  awsAccountId: string | null; // Nullable when account is deleted
  status: ScanStatus;
  hasKey: boolean; // false when associated AWS account is deleted
  startedAt: string | null;
  completedAt: string | null;
  resourcesDiscovered: number;
  // Diff fields - compared to previous scan
  resourcesDelta: number;
  findingsNew: number;
  findingsResolved: number;
  errorMessage: string | null;
  createdAt: string;
}

// Jobs
export type JobType =
  | "scan_account"
  | "analyze_orphans"
  | "analyze_ssl"
  | "analyze_residency"
  | "analyze_security"
  | "analyze_cost"
  | "analyze_tagging"
  | "analyze_iam";

export type JobStatus = "queued" | "running" | "complete" | "error";

export interface Job {
  id: string;
  type: JobType;
  payload: Record<string, unknown>;
  status: JobStatus;
  result: Record<string, unknown> | null;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

// API Response Types
export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Filter Types
export interface FindingFilters {
  type?: FindingType;
  types?: FindingType[];  // For multi-type filtering (e.g., orphaned resources)
  severity?: FindingSeverity;
  status?: FindingStatus;
  awsAccountId?: string;
  resourceId?: string;
  page?: number;
  limit?: number;
}

export interface ResourceFilters {
  service?: ServiceType;
  region?: string;
  awsAccountId?: string;
  state?: string;
  costFilter?: CostFilterType;
  page?: number;
  limit?: number;
}

// Dashboard Summary (Legacy - keep for backward compatibility)
export interface DashboardSummary {
  totalResources: number;
  resourcesTrend: number;
  orphanedResources: number;
  orphanedSavings: number;
  expiringCertificates: number;
  urgentCertificates: number;
  residencyViolations: number;
}

// Enhanced Dashboard Summary with full metrics
export interface EnhancedDashboardSummary extends DashboardSummary {
  // Health scores by category (0-100)
  healthScores: {
    overall: number;
    security: number;
    compliance: number;
    costEfficiency: number;
  };

  // Health status text
  healthStatus: 'excellent' | 'good' | 'fair' | 'needs_attention';

  // Issues to resolve for next status level
  issuesToResolve: number;

  // Finding counts by severity (for open findings only)
  findingCounts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    trivial: number;
    total: number;
  };

  // Cost insights
  costInsights: {
    totalPotentialSavings: number;
    byCategory: Array<{
      type: string;
      label: string;
      count: number;
      savings: number;
    }>;
  };

  // Certificate insights
  certificateInsights: {
    total: number;
    healthy: number;
    expiringSoon: number;  // 7-30 days
    urgent: number;        // <7 days
    nearestExpiryDays: number | null;
  };

  // Resource health by state
  resourceHealth: {
    total: number;
    healthy: number;
    warning: number;
    critical: number;
    orphaned: number;
  };

  // Compliance details
  complianceDetails: {
    residencyViolations: number;
    missingTags: number;
    securityIssues: number;
  };
}

// Stats
export interface ResourceStats {
  totalCount: number;
  byService: Record<string, number>;
  byRegion: Record<string, number>;
  byState: Record<string, number>;
  costByService?: Record<string, { count: number; totalCost: number }>;
}

export interface FindingStats {
  totalCount: number;
  byType: Record<string, number>;
  bySeverity: Record<string, number>;
  byStatus: Record<string, number>;
  byTypeSeverity: Record<string, string>;  // type -> severity mapping for filtering
}

// Auth Types
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupCredentials {
  email: string;
  password: string;
  fullName?: string;
}

// Login response without 2FA
export interface LoginResponseSuccess {
  user: User;
  orgs: Org[];
  accessToken: string;
  requires2FA?: false;
}

// Login response when 2FA is required
export interface LoginResponse2FA {
  requires2FA: true;
  challengeToken: string;
}

export type LoginResponse = LoginResponseSuccess | LoginResponse2FA;

export interface SignupResponse {
  user: User;
  org: Org | null;
  accessToken: string;
}

export interface MeResponse {
  user: User;
  orgs: Org[];
}

// AWS Onboarding
export interface CreateAwsAccountInput {
  name: string;
  awsAccountId: string;
  roleArn: string;
  externalId?: string;
  enabledScanners?: ScannerType[];
}

export interface TestConnectionResult {
  success: boolean;
  message: string;
  regions?: string[];
}

// Resource Dependencies
export type RelationshipType =
  | 'uses_role'      // Lambda/EC2 → IAM Role
  | 'in_vpc'         // EC2/RDS/Lambda → VPC
  | 'in_subnet'      // EC2/RDS/ENI → Subnet
  | 'uses_sg'        // EC2/RDS/Lambda/ENI → Security Group
  | 'attached_to'    // EBS/ENI → EC2
  | 'targets'        // Target Group → EC2/Lambda
  | 'owns'           // ALB → Target Group
  | 'uses_layer'     // Lambda → Lambda Layer
  | 'encrypted_by';  // EBS/RDS/S3 → KMS Key

export interface DependencyWithResource {
  id: string;
  targetResourceId: string;
  targetService: string;
  relationshipType: RelationshipType;
  createdAt: string;
  targetResource?: {
    id: string;
    name: string | null;
    region: string | null;
    state: string | null;
  };
}

export interface DependentWithResource {
  id: string;
  sourceResourceId: string;
  sourceService: string;
  relationshipType: RelationshipType;
  createdAt: string;
  sourceResource: {
    id: string;
    resourceId: string;
    name: string | null;
    region: string | null;
    state: string | null;
    service: string;
  };
}

// Resource Scan History
export type ResourceScanStatus = 'new' | 'updated' | 'removed';

export interface ResourceScanHistory {
  id: string;
  scanId: string;
  status: ResourceScanStatus;
  createdAt: string;
  scanStartedAt: string | null;
  scanCompletedAt: string | null;
  scanStatus: ScanStatus;
  resourcesDiscovered: number;
  resourcesDelta: number;
}

// Finding Scan History (detection tracking)
export type FindingScanStatus = 'detected' | 'not_detected';

export interface FindingScanHistory {
  id: string;
  findingId: string;
  scanId: string;
  status: FindingScanStatus;
  createdAt: string;
  scan?: {
    id: string;
    status: ScanStatus;
    startedAt: string | null;
    completedAt: string | null;
    resourcesDiscovered: number;
  };
}

// Finding timeline entry for resource detail view
export interface FindingTimelineEntry {
  finding: Finding;
  detectionHistory: Array<{
    id: string;
    status: FindingScanStatus;
    createdAt: string;
    scan: {
      id: string;
      completedAt: string | null;
    };
  }>;
}
