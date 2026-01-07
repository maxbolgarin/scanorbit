// User & Organization
export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface Org {
  id: string;
  name: string;
  createdAt: string;
}

// AWS Account
export type AwsAccountStatus = "pending" | "ok" | "error";

export interface AwsAccount {
  id: string;
  orgId: string;
  name: string;
  awsAccountId: string;
  roleArn: string;
  externalId?: string;
  status: AwsAccountStatus;
  lastScanAt?: string;
  createdAt: string;
  updatedAt: string;
}

// Resources
export type ServiceType = "ec2" | "ebs" | "rds" | "s3" | "alb" | "acm" | "eip" | "snapshot";

export type ResourceState = "running" | "stopped" | "available" | "in-use" | "active" | "inactive";

export interface Resource {
  id: string;
  orgId: string;
  awsAccountId: string;
  region: string;
  service: ServiceType;
  resourceId: string;
  name: string;
  state: ResourceState;
  tags: Record<string, string>;
  costEstimateMonthly?: number;
  lastSeenAt: string;
  raw?: Record<string, unknown>;
}

// Certificates
export type CertificateSource = "acm" | "endpoint_scan";

export interface Certificate {
  id: string;
  orgId: string;
  awsAccountId: string;
  source: CertificateSource;
  identifier: string;
  primaryDomain: string;
  altNames: string[];
  notBefore: string;
  notAfter: string;
  issuer: string;
  lastSeenAt: string;
}

// Findings
export type FindingType =
  | "orphaned_volume"
  | "orphaned_eip"
  | "orphaned_snapshot"
  | "ssl_expiry"
  | "data_residency_violation";

export type FindingSeverity = "low" | "medium" | "high";

export type FindingStatus = "open" | "resolved" | "snoozed" | "ignored";

export interface Finding {
  id: string;
  orgId: string;
  awsAccountId: string;
  resourceId?: string;
  certificateId?: string;
  type: FindingType;
  severity: FindingSeverity;
  status: FindingStatus;
  summary: string;
  details: {
    description: string;
    recommendation: string;
    estimatedSavings?: number;
    expiresAt?: string;
    region?: string;
    awsConsoleUrl?: string;
    [key: string]: unknown;
  };
  snoozedUntil?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  createdAt: string;
}

// Scans
export type ScanStatus = "queued" | "running" | "completed" | "failed";

export interface Scan {
  id: string;
  awsAccountId: string;
  status: ScanStatus;
  progress: number;
  currentStep?: string;
  resourcesDiscovered?: number;
  findingsCount?: number;
  startedAt: string;
  completedAt?: string;
  error?: string;
}

// Jobs
export type JobType = "scan_account" | "analyze_orphans" | "analyze_ssl" | "analyze_data_residency";

export type JobStatus = "queued" | "running" | "done" | "error";

export interface Job {
  id: string;
  type: JobType;
  payload: Record<string, unknown>;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
}

// API Response Types
export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Filter Types
export interface FindingFilters {
  type?: FindingType;
  severity?: FindingSeverity;
  status?: FindingStatus;
  awsAccountId?: string;
  search?: string;
}

export interface ResourceFilters {
  service?: ServiceType;
  region?: string;
  awsAccountId?: string;
  state?: ResourceState;
  search?: string;
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

// Auth Types
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupCredentials {
  email: string;
  password: string;
  name?: string;
}

export interface AuthResponse {
  user: User;
  org: Org | null;
  token: string;
}

// AWS Onboarding
export interface CreateAwsAccountInput {
  name: string;
  awsAccountId: string;
}

export interface ConnectAwsRoleInput {
  roleArn: string;
  externalId?: string;
}

export interface TestConnectionResult {
  success: boolean;
  message: string;
  regions?: string[];
}
