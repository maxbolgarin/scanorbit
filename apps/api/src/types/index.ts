import type { Context } from 'hono';

// =============================================================================
// Subscription Tiers
// =============================================================================

export const SubscriptionTier = {
  FREE: 'free',
  PRO: 'pro',
  TEAM: 'team',
} as const;
export type SubscriptionTier = (typeof SubscriptionTier)[keyof typeof SubscriptionTier];

export interface TierLimits {
  scanCooldownMinutes: number | null; // null = unlimited or one-time only (for free)
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
  canUseApiKeys: boolean;
}

export const TIER_LIMITS: Record<SubscriptionTier, TierLimits> = {
  free: {
    scanCooldownMinutes: null, // Only one successful scan ever allowed
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
    canUseApiKeys: false,
  },
  pro: {
    scanCooldownMinutes: 60, // 1 hour cooldown
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
    canUseApiKeys: false,
  },
  team: {
    scanCooldownMinutes: null, // Unlimited
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
    canUseApiKeys: true,
  },
} as const;

export const SEAT_BILLING = {
  INCLUDED_SEATS: 5,
  SEAT_PRICE_MONTHLY: 10,
} as const;

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

// JWT Payload type
export interface JWTPayload {
  userId: string;
  orgId: string | null;
}

// Hono context variables type
export interface Variables {
  userId: string;
  orgId: string;
}

// Type for authenticated context
export type AuthContext = Context<{ Variables: Variables }>;

// Common API response types
export interface SuccessResponse<T> {
  data: T;
}

export interface ErrorResponse {
  error: string;
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

// Common filter types
export interface PaginationParams {
  page?: number;
  limit?: number;
}

export type CostFilterType = 'all' | 'paid' | 'free';

export interface ResourceFilters extends PaginationParams {
  awsAccountId?: string;
  region?: string;
  service?: string;
  state?: string;
  costFilter?: CostFilterType;
}

export interface FindingFilters extends PaginationParams {
  awsAccountId?: string;
  resourceId?: string;
  type?: string;
  severity?: string;
  status?: string;
}

// Enums as const objects (for type safety)
export const UserRole = {
  ADMIN: 'admin',
  MEMBER: 'member',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const AwsAccountStatus = {
  PENDING: 'pending',
  OK: 'ok',
  ERROR: 'error',
} as const;
export type AwsAccountStatus = (typeof AwsAccountStatus)[keyof typeof AwsAccountStatus];

export const ScanStatus = {
  QUEUED: 'queued',
  PROCESSING: 'processing',
  RUNNING: 'running',
  ANALYZING: 'analyzing',
  COMPLETE: 'complete',
  PARTIAL: 'partial',
  ERROR: 'error',
  CANCELED: 'canceled',
} as const;
export type ScanStatus = (typeof ScanStatus)[keyof typeof ScanStatus];

// Active scan statuses (in progress)
export const ACTIVE_SCAN_STATUSES: ScanStatus[] = [
  ScanStatus.QUEUED,
  ScanStatus.PROCESSING,
  ScanStatus.RUNNING,
  ScanStatus.ANALYZING,
];

// Terminal scan statuses (finished)
export const TERMINAL_SCAN_STATUSES: ScanStatus[] = [
  ScanStatus.COMPLETE,
  ScanStatus.PARTIAL,
  ScanStatus.ERROR,
  ScanStatus.CANCELED,
];

export const FindingType = {
  // Orphan findings
  ORPHANED_VOLUME: 'orphaned_volume',
  ORPHANED_EIP: 'orphaned_eip',
  ORPHANED_SNAPSHOT: 'orphaned_snapshot',
  ORPHANED_ENI: 'orphaned_eni',
  IDLE_LOAD_BALANCER: 'idle_load_balancer',
  UNUSED_SECURITY_GROUP: 'unused_security_group',
  IDLE_NAT_GATEWAY: 'idle_nat_gateway',
  // SSL findings
  SSL_EXPIRY: 'ssl_expiry',
  // Compliance findings
  DATA_RESIDENCY_VIOLATION: 'data_residency_violation',
  // Security findings
  UNENCRYPTED_RESOURCE: 'unencrypted_resource',
  PUBLIC_ACCESS: 'public_access',
  PERMISSIVE_SECURITY_GROUP: 'permissive_security_group',
  OPEN_ALL_PORTS: 'open_all_ports',
  // Cost findings
  UNUSED_RESOURCE: 'unused_resource',
  STOPPED_INSTANCE: 'stopped_instance',
  UNUSED_LOG_GROUP: 'unused_log_group',
  EBS_OPTIMIZATION: 'ebs_optimization',
  OLD_GEN_INSTANCE: 'old_gen_instance',
  OVERSIZED_LAMBDA: 'oversized_lambda',
  LOG_RETENTION: 'log_retention',
  UNUSED_KMS_KEY: 'unused_kms_key',
  RDS_OPTIMIZATION: 'rds_optimization',
  OLD_GEN_RDS: 'old_gen_rds',
  // Tagging findings
  MISSING_TAG: 'missing_tag',
  // IAM findings
  USER_WITHOUT_MFA: 'user_without_mfa',
  OLD_ACCESS_KEY: 'old_access_key',
  UNUSED_ACCESS_KEY: 'unused_access_key',
  UNUSED_IAM_ROLE: 'unused_iam_role',
} as const;
export type FindingType = (typeof FindingType)[keyof typeof FindingType];

export const FindingSeverity = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  TRIVIAL: 'trivial',
} as const;
export type FindingSeverity = (typeof FindingSeverity)[keyof typeof FindingSeverity];

export const FindingStatus = {
  OPEN: 'open',
  RESOLVED: 'resolved',
  SNOOZED: 'snoozed',
  IGNORED: 'ignored',
} as const;
export type FindingStatus = (typeof FindingStatus)[keyof typeof FindingStatus];

export const ResourceService = {
  EC2: 'ec2',
  EBS: 'ebs',
  RDS: 'rds',
  S3: 's3',
  ALB: 'alb',
  ACM: 'acm',
  EIP: 'eip',
  SNAPSHOT: 'snapshot',
} as const;
export type ResourceService = (typeof ResourceService)[keyof typeof ResourceService];

export const JobType = {
  SCAN_ACCOUNT: 'scan_account',
  ANALYZE_ORPHANS: 'analyze_orphans',
  ANALYZE_SSL: 'analyze_ssl',
  ANALYZE_DATA_RESIDENCY: 'analyze_data_residency',
  ANALYZE_SECURITY: 'analyze_security',
  ANALYZE_COST: 'analyze_cost',
  ANALYZE_TAGGING: 'analyze_tagging',
  ANALYZE_IAM: 'analyze_iam',
} as const;
export type JobType = (typeof JobType)[keyof typeof JobType];

export const JobStatus = {
  QUEUED: 'queued',
  RUNNING: 'running',
  COMPLETE: 'complete',
  ERROR: 'error',
} as const;
export type JobStatus = (typeof JobStatus)[keyof typeof JobStatus];

// Scanner Types
export const ScannerType = {
  EC2: 'ec2',
  RDS: 'rds',
  S3: 's3',
  ALB: 'alb',
  ACM: 'acm',
  LAMBDA: 'lambda',
  CLOUDWATCH: 'cloudwatch',
  IAM: 'iam',
  SECURITY_GROUPS: 'security_groups',
  SECRETS_MANAGER: 'secrets_manager',
  KMS: 'kms',
} as const;
export type ScannerType = (typeof ScannerType)[keyof typeof ScannerType];

export const ALL_SCANNER_TYPES: ScannerType[] = Object.values(ScannerType);

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
    id: 'ec2_compute',
    label: 'EC2 & Compute',
    description: 'EC2 instances, EBS volumes, EIPs, ENIs, NAT Gateways, Security Groups',
    scanners: [ScannerType.EC2, ScannerType.SECURITY_GROUPS],
    iamActions: [
      'ec2:DescribeInstances',
      'ec2:DescribeVolumes',
      'ec2:DescribeAddresses',
      'ec2:DescribeNetworkInterfaces',
      'ec2:DescribeNatGateways',
      'ec2:DescribeSecurityGroups',
      'ec2:DescribeSecurityGroupRules',
      'ec2:DescribeRegions',
    ],
  },
  {
    id: 'database',
    label: 'Database',
    description: 'RDS instances and snapshots',
    scanners: [ScannerType.RDS],
    iamActions: [
      'rds:DescribeDBInstances',
      'rds:DescribeDBSnapshots',
      'rds:ListTagsForResource',
    ],
  },
  {
    id: 'storage',
    label: 'Storage',
    description: 'S3 buckets and policies',
    scanners: [ScannerType.S3],
    iamActions: [
      's3:ListAllMyBuckets',
      's3:GetBucketLocation',
      's3:GetBucketTagging',
      's3:GetBucketPolicy',
      's3:GetBucketPolicyStatus',
      's3:GetPublicAccessBlock',
    ],
  },
  {
    id: 'networking',
    label: 'Load Balancing',
    description: 'Application/Network Load Balancers and Target Groups',
    scanners: [ScannerType.ALB],
    iamActions: [
      'elasticloadbalancing:DescribeLoadBalancers',
      'elasticloadbalancing:DescribeTargetGroups',
      'elasticloadbalancing:DescribeTags',
    ],
  },
  {
    id: 'certificates',
    label: 'Certificates',
    description: 'ACM SSL/TLS certificates',
    scanners: [ScannerType.ACM],
    iamActions: [
      'acm:ListCertificates',
      'acm:DescribeCertificate',
      'acm:ListTagsForCertificate',
    ],
  },
  {
    id: 'serverless',
    label: 'Serverless',
    description: 'Lambda functions',
    scanners: [ScannerType.LAMBDA],
    iamActions: [
      'lambda:ListFunctions',
      'lambda:GetFunction',
      'lambda:ListTags',
    ],
  },
  {
    id: 'monitoring',
    label: 'Monitoring',
    description: 'CloudWatch Log Groups and Alarms',
    scanners: [ScannerType.CLOUDWATCH],
    iamActions: [
      'logs:DescribeLogGroups',
      'logs:ListTagsForResource',
      'cloudwatch:DescribeAlarms',
      'cloudwatch:ListTagsForResource',
    ],
  },
  {
    id: 'identity',
    label: 'Identity & Access',
    description: 'IAM Users, Roles, and Access Keys',
    scanners: [ScannerType.IAM],
    iamActions: [
      'iam:ListUsers',
      'iam:ListUserTags',
      'iam:ListMFADevices',
      'iam:ListRoles',
      'iam:ListRoleTags',
      'iam:GetRole',
      'iam:ListAccessKeys',
      'iam:GetAccessKeyLastUsed',
      'iam:ListAttachedRolePolicies',
      'iam:ListRolePolicies',
      'iam:GetRolePolicy',
    ],
  },
  {
    id: 'secrets',
    label: 'Secrets & Encryption',
    description: 'Secrets Manager secrets and KMS keys',
    scanners: [ScannerType.SECRETS_MANAGER, ScannerType.KMS],
    iamActions: [
      'secretsmanager:ListSecrets',
      'secretsmanager:DescribeSecret',
      'kms:ListKeys',
      'kms:DescribeKey',
      'kms:ListResourceTags',
      'kms:GetKeyRotationStatus',
    ],
  },
];

// Helper to generate IAM policy from selected categories
export function generateIAMPolicy(selectedCategories: string[]): string {
  const actions: string[] = [];

  PERMISSION_CATEGORIES.forEach(category => {
    if (selectedCategories.includes(category.id)) {
      actions.push(...category.iamActions);
    }
  });

  // Deduplicate actions
  const uniqueActions = [...new Set(actions)];

  const policy = {
    Version: '2012-10-17',
    Statement: [
      {
        Sid: 'ScanOrbitReadAccess',
        Effect: 'Allow',
        Action: uniqueActions,
        Resource: '*',
      },
    ],
  };

  return JSON.stringify(policy, null, 2);
}

// Helper to generate trust policy
export function generateTrustPolicy(externalId: string, trustedAccountId: string): string {
  const trustPolicy = {
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Principal: {
          AWS: `arn:aws:iam::${trustedAccountId}:root`,
        },
        Action: 'sts:AssumeRole',
        Condition: {
          StringEquals: {
            'sts:ExternalId': externalId,
          },
        },
      },
    ],
  };

  return JSON.stringify(trustPolicy, null, 2);
}

// Get scanners from selected categories
export function getScannersFromCategories(selectedCategories: string[]): ScannerType[] {
  const scanners: ScannerType[] = [];

  PERMISSION_CATEGORIES.forEach(category => {
    if (selectedCategories.includes(category.id)) {
      scanners.push(...category.scanners);
    }
  });

  return [...new Set(scanners)];
}

// Get categories from enabled scanners (reverse mapping)
export function getCategoriesFromScanners(enabledScanners: ScannerType[]): string[] {
  return PERMISSION_CATEGORIES
    .filter(category => category.scanners.every(s => enabledScanners.includes(s)))
    .map(category => category.id);
}

// Analyzer to scanner dependencies
export const ANALYZER_SCANNER_DEPS: Record<string, ScannerType[]> = {
  analyze_orphans: [ScannerType.EC2, ScannerType.SECURITY_GROUPS],
  analyze_ssl: [ScannerType.ACM, ScannerType.ALB],
  analyze_residency: [ScannerType.EC2, ScannerType.RDS, ScannerType.S3, ScannerType.LAMBDA],
  analyze_security: [ScannerType.EC2, ScannerType.RDS, ScannerType.S3, ScannerType.SECURITY_GROUPS, ScannerType.KMS],
  analyze_cost: [ScannerType.EC2, ScannerType.RDS, ScannerType.LAMBDA, ScannerType.CLOUDWATCH, ScannerType.ALB],
  analyze_tagging: [ScannerType.EC2, ScannerType.RDS, ScannerType.S3, ScannerType.LAMBDA, ScannerType.ALB],
  analyze_iam: [ScannerType.IAM],
};

// Get analyzers that should run based on enabled scanners
export function getAnalyzersForScanners(enabledScanners: ScannerType[]): string[] {
  return Object.entries(ANALYZER_SCANNER_DEPS)
    .filter(([_, deps]) => deps.some(d => enabledScanners.includes(d)))
    .map(([analyzer]) => analyzer);
}

// =============================================================================
// OAuth Types
// =============================================================================

export const OAuthProvider = {
  GOOGLE: 'google',
  GITHUB: 'github',
} as const;
export type OAuthProvider = (typeof OAuthProvider)[keyof typeof OAuthProvider];

// Google user info from ID token verification
export interface GoogleUserInfo {
  googleId: string;
  email: string;
  emailVerified: boolean;
  fullName?: string;
  picture?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: Date | null;
  rawProfile?: Record<string, unknown>;
}

// Result from Google OAuth authentication (without 2FA)
export interface GoogleAuthResultSuccess {
  user: {
    id: string;
    email: string;
    fullName: string | null;
  };
  orgs: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
  isNewUser: boolean;
  hasOrg: boolean;
  requires2FA?: false;
  requiresConsent?: false;
}

// Result when 2FA is required
export interface GoogleAuthResult2FA {
  requires2FA: true;
  requiresConsent?: false;
  challengeToken: string;
  isNewUser: boolean;
}

// Result when consent is required for new OAuth users
export interface GoogleAuthResultConsent {
  requiresConsent: true;
  requires2FA?: false;
  consentToken: string;
  email: string;
  fullName: string | null;
}

// Combined type
export type GoogleAuthResult = GoogleAuthResultSuccess | GoogleAuthResult2FA | GoogleAuthResultConsent;

// GitHub user info from OAuth
export interface GitHubUserInfo {
  githubId: string;
  email: string;
  emailVerified: boolean;
  fullName?: string;
  picture?: string;
  username?: string; // GitHub login handle
  accessToken?: string;
  rawProfile?: Record<string, unknown>;
}

// Result from GitHub OAuth authentication (without 2FA)
export interface GitHubAuthResultSuccess {
  user: {
    id: string;
    email: string;
    fullName: string | null;
  };
  orgs: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
  isNewUser: boolean;
  hasOrg: boolean;
  requires2FA?: false;
  requiresConsent?: false;
}

// Result when 2FA is required
export interface GitHubAuthResult2FA {
  requires2FA: true;
  requiresConsent?: false;
  challengeToken: string;
  isNewUser: boolean;
}

// Result when consent is required for new OAuth users
export interface GitHubAuthResultConsent {
  requiresConsent: true;
  requires2FA?: false;
  consentToken: string;
  email: string;
  fullName: string | null;
}

// Combined type
export type GitHubAuthResult = GitHubAuthResultSuccess | GitHubAuthResult2FA | GitHubAuthResultConsent;
