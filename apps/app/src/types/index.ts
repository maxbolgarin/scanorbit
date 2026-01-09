// User & Organization
export interface User {
  id: string;
  email: string;
  fullName: string | null;
  emailVerified?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Org {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrgMember {
  id: string;
  userId: string;
  orgId: string;
  role: "admin" | "member";
  createdAt: string;
  user?: User;
}

// AWS Account
export type AwsAccountStatus = "pending" | "ok" | "error";

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
  | "kms_key";

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
  // SSL findings
  | "ssl_expiry"
  // Compliance findings
  | "data_residency_violation"
  // Security findings
  | "unencrypted_resource"
  | "public_access"
  | "permissive_security_group"
  | "open_all_ports"
  // Cost findings
  | "unused_resource"
  | "stopped_instance"
  | "unused_log_group"
  // Tagging findings
  | "missing_tag"
  // IAM findings
  | "old_access_key"
  | "unused_access_key"
  | "unused_iam_role"
  | "user_without_mfa";

export type FindingSeverity = "low" | "medium" | "high";

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
  createdAt: string;
  updatedAt: string;
  // Joined fields
  resource?: Resource;
  certificate?: Certificate;
  awsAccount?: AwsAccount;
}

// Scans
export type ScanStatus = "pending" | "running" | "complete" | "error";

export interface Scan {
  id: string;
  orgId: string;
  awsAccountId: string;
  status: ScanStatus;
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
  severity?: FindingSeverity;
  status?: FindingStatus;
  awsAccountId?: string;
  page?: number;
  limit?: number;
}

export interface ResourceFilters {
  service?: ServiceType;
  region?: string;
  awsAccountId?: string;
  state?: string;
  page?: number;
  limit?: number;
}

// Dashboard Summary
export interface DashboardSummary {
  totalResources: number;
  resourcesTrend: number;
  orphanedResources: number;
  orphanedSavings: number;
  expiringCertificates: number;
  urgentCertificates: number;
  residencyViolations: number;
}

// Stats
export interface ResourceStats {
  totalCount: number;
  byService: Record<string, number>;
  byRegion: Record<string, number>;
  byState: Record<string, number>;
}

export interface FindingStats {
  totalCount: number;
  byType: Record<string, number>;
  bySeverity: Record<string, number>;
  byStatus: Record<string, number>;
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

export interface LoginResponse {
  user: User;
  orgs: Org[];
  token: string;
}

export interface SignupResponse {
  user: User;
  org: Org | null;
  token: string;
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
}

export interface TestConnectionResult {
  success: boolean;
  message: string;
  regions?: string[];
}
