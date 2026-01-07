import type { Context } from 'hono';

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

export interface ResourceFilters extends PaginationParams {
  awsAccountId?: string;
  region?: string;
  service?: string;
  state?: string;
}

export interface FindingFilters extends PaginationParams {
  awsAccountId?: string;
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
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETE: 'complete',
  ERROR: 'error',
} as const;
export type ScanStatus = (typeof ScanStatus)[keyof typeof ScanStatus];

export const FindingType = {
  ORPHANED_VOLUME: 'orphaned_volume',
  ORPHANED_EIP: 'orphaned_eip',
  ORPHANED_SNAPSHOT: 'orphaned_snapshot',
  SSL_EXPIRY: 'ssl_expiry',
  DATA_RESIDENCY_VIOLATION: 'data_residency_violation',
} as const;
export type FindingType = (typeof FindingType)[keyof typeof FindingType];

export const FindingSeverity = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
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
} as const;
export type JobType = (typeof JobType)[keyof typeof JobType];

export const JobStatus = {
  QUEUED: 'queued',
  RUNNING: 'running',
  COMPLETE: 'complete',
  ERROR: 'error',
} as const;
export type JobStatus = (typeof JobStatus)[keyof typeof JobStatus];
