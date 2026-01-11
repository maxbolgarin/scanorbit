import { pgTable, uuid, varchar, text, timestamp, jsonb, numeric, uniqueIndex, index, integer, boolean } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Users
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  fullName: varchar('full_name', { length: 255 }),
  emailVerified: boolean('email_verified').default(false).notNull(),
  emailVerificationCode: varchar('email_verification_code', { length: 6 }),
  emailVerificationExpiresAt: timestamp('email_verification_expires_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  orgMembers: many(userOrgMembers),
}));

// Organizations
export const orgs = pgTable('orgs', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  logoUrl: varchar('logo_url', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const orgsRelations = relations(orgs, ({ many }) => ({
  members: many(userOrgMembers),
  awsAccounts: many(awsAccounts),
  resources: many(resources),
  certificates: many(certificates),
  findings: many(findings),
  scans: many(scans),
}));

// User-Org memberships
export const userOrgMembers = pgTable('user_org_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  orgId: uuid('org_id').notNull().references(() => orgs.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 50 }).default('member').notNull(), // 'admin', 'member'
  title: varchar('title', { length: 50 }), // 'devops', 'cto', 'developer', 'security', 'personal', 'other' (analytics only)
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('user_org_members_user_org_idx').on(table.userId, table.orgId),
  index('user_org_members_user_id_idx').on(table.userId),
  index('user_org_members_org_id_idx').on(table.orgId),
]);

export const userOrgMembersRelations = relations(userOrgMembers, ({ one }) => ({
  user: one(users, {
    fields: [userOrgMembers.userId],
    references: [users.id],
  }),
  org: one(orgs, {
    fields: [userOrgMembers.orgId],
    references: [orgs.id],
  }),
}));

// AWS Accounts
export const awsAccounts = pgTable('aws_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => orgs.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  awsAccountId: varchar('aws_account_id', { length: 12 }).notNull(),
  roleArn: varchar('role_arn', { length: 255 }).notNull(),
  externalId: varchar('external_id', { length: 255 }),
  status: varchar('status', { length: 50 }).default('pending').notNull(), // 'pending', 'ok', 'error'
  lastError: text('last_error'),
  lastScanAt: timestamp('last_scan_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('aws_accounts_org_account_idx').on(table.orgId, table.awsAccountId),
  index('aws_accounts_org_id_idx').on(table.orgId),
]);

export const awsAccountsRelations = relations(awsAccounts, ({ one, many }) => ({
  org: one(orgs, {
    fields: [awsAccounts.orgId],
    references: [orgs.id],
  }),
  resources: many(resources),
  certificates: many(certificates),
  findings: many(findings),
  scans: many(scans),
}));

// Scans
export const scans = pgTable('scans', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => orgs.id, { onDelete: 'cascade' }),
  awsAccountId: uuid('aws_account_id').notNull().references(() => awsAccounts.id, { onDelete: 'cascade' }),
  status: varchar('status', { length: 50 }).default('pending').notNull(), // 'pending', 'running', 'complete', 'error'
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  resourcesDiscovered: integer('resources_discovered').default(0).notNull(),
  // Diff fields - compared to previous scan
  resourcesDelta: integer('resources_delta').default(0).notNull(), // positive = new resources, negative = removed
  findingsNew: integer('findings_new').default(0).notNull(),
  findingsResolved: integer('findings_resolved').default(0).notNull(),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('scans_org_id_idx').on(table.orgId),
  index('scans_aws_account_id_idx').on(table.awsAccountId),
]);

export const scansRelations = relations(scans, ({ one }) => ({
  org: one(orgs, {
    fields: [scans.orgId],
    references: [orgs.id],
  }),
  awsAccount: one(awsAccounts, {
    fields: [scans.awsAccountId],
    references: [awsAccounts.id],
  }),
}));

// Resources
export const resources = pgTable('resources', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => orgs.id, { onDelete: 'cascade' }),
  awsAccountId: uuid('aws_account_id').notNull().references(() => awsAccounts.id, { onDelete: 'cascade' }),
  resourceId: varchar('resource_id', { length: 255 }).notNull(), // ARN or provider ID
  service: varchar('service', { length: 50 }).notNull(), // 'ec2', 'ebs', 'eip', 'rds', 'rds_snapshot', 's3', 'alb', 'acm', 'lambda', 'cloudwatch_logs', 'cloudwatch_alarm', 'iam_user', 'iam_role', 'iam_policy', 'iam_access_key', 'security_group', 'secret', 'kms_key'
  region: varchar('region', { length: 50 }),
  name: varchar('name', { length: 255 }),
  state: varchar('state', { length: 50 }), // 'available', 'running', 'pending', etc.
  tags: jsonb('tags').default({}).notNull(),
  costEstimateMonthly: numeric('cost_estimate_monthly', { precision: 10, scale: 2 }),
  lastSeenAt: timestamp('last_seen_at').defaultNow().notNull(),
  raw: jsonb('raw'), // Full provider response
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('resources_org_account_resource_idx').on(table.orgId, table.awsAccountId, table.resourceId),
  index('resources_org_id_idx').on(table.orgId),
  index('resources_aws_account_id_idx').on(table.awsAccountId),
  index('resources_service_idx').on(table.service),
]);

export const resourcesRelations = relations(resources, ({ one, many }) => ({
  org: one(orgs, {
    fields: [resources.orgId],
    references: [orgs.id],
  }),
  awsAccount: one(awsAccounts, {
    fields: [resources.awsAccountId],
    references: [awsAccounts.id],
  }),
  findings: many(findings),
}));

// Certificates
export const certificates = pgTable('certificates', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => orgs.id, { onDelete: 'cascade' }),
  awsAccountId: uuid('aws_account_id').notNull().references(() => awsAccounts.id, { onDelete: 'cascade' }),
  identifier: varchar('identifier', { length: 255 }).notNull(), // ARN or fingerprint
  source: varchar('source', { length: 50 }).notNull(), // 'acm', 'endpoint_scan'
  primaryDomain: varchar('primary_domain', { length: 255 }),
  altNames: jsonb('alt_names').default([]).notNull(),
  notBefore: timestamp('not_before'),
  notAfter: timestamp('not_after'),
  issuer: varchar('issuer', { length: 255 }),
  algorithm: varchar('algorithm', { length: 50 }),
  lastSeenAt: timestamp('last_seen_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('certificates_org_account_identifier_idx').on(table.orgId, table.awsAccountId, table.identifier),
  index('certificates_org_id_idx').on(table.orgId),
]);

export const certificatesRelations = relations(certificates, ({ one, many }) => ({
  org: one(orgs, {
    fields: [certificates.orgId],
    references: [orgs.id],
  }),
  awsAccount: one(awsAccounts, {
    fields: [certificates.awsAccountId],
    references: [awsAccounts.id],
  }),
  findings: many(findings),
}));

// Findings
export const findings = pgTable('findings', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => orgs.id, { onDelete: 'cascade' }),
  awsAccountId: uuid('aws_account_id').notNull().references(() => awsAccounts.id, { onDelete: 'cascade' }),
  resourceId: uuid('resource_id').references(() => resources.id, { onDelete: 'set null' }),
  certificateId: uuid('certificate_id').references(() => certificates.id, { onDelete: 'set null' }),
  type: varchar('type', { length: 50 }).notNull(), // 'orphaned_volume', 'orphaned_eip', 'orphaned_snapshot', 'ssl_expiry', 'data_residency_violation', 'unencrypted_resource', 'public_access', 'permissive_security_group', 'open_all_ports', 'unused_resource', 'stopped_instance', 'unused_log_group', 'missing_tag', 'old_access_key', 'unused_access_key', 'unused_iam_role', 'user_without_mfa'
  severity: varchar('severity', { length: 50 }).notNull(), // 'low', 'medium', 'high'
  summary: text('summary').notNull(),
  details: jsonb('details').default({}).notNull(),
  status: varchar('status', { length: 50 }).default('open').notNull(), // 'open', 'resolved', 'snoozed', 'ignored'
  resolvedAt: timestamp('resolved_at'),
  snoozedUntil: timestamp('snoozed_until'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('findings_org_id_idx').on(table.orgId),
  index('findings_type_idx').on(table.type),
  index('findings_severity_idx').on(table.severity),
  index('findings_status_idx').on(table.status),
]);

export const findingsRelations = relations(findings, ({ one }) => ({
  org: one(orgs, {
    fields: [findings.orgId],
    references: [orgs.id],
  }),
  awsAccount: one(awsAccounts, {
    fields: [findings.awsAccountId],
    references: [awsAccounts.id],
  }),
  resource: one(resources, {
    fields: [findings.resourceId],
    references: [resources.id],
  }),
  certificate: one(certificates, {
    fields: [findings.certificateId],
    references: [certificates.id],
  }),
}));

// Jobs (for background workers)
export const jobs = pgTable('jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: varchar('type', { length: 50 }).notNull(), // 'scan_account', 'analyze_orphans', 'analyze_ssl', 'analyze_residency', 'analyze_security', 'analyze_cost', 'analyze_tagging', 'analyze_iam'
  payload: jsonb('payload').notNull(),
  status: varchar('status', { length: 50 }).default('queued').notNull(), // 'queued', 'running', 'complete', 'error'
  result: jsonb('result'),
  error: text('error'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
}, (table) => [
  index('jobs_status_idx').on(table.status),
  index('jobs_type_idx').on(table.type),
]);

// Consent Logs (GDPR compliance)
export const consentLogs = pgTable('consent_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  email: varchar('email', { length: 255 }).notNull(),
  // Consent details
  consentType: varchar('consent_type', { length: 50 }).notNull(), // 'terms_and_privacy', 'marketing', etc.
  consentVersion: varchar('consent_version', { length: 50 }).notNull(), // e.g., '1.0', '2024-01-01'
  consentGiven: boolean('consent_given').notNull(),
  // GDPR required fields
  ipAddress: varchar('ip_address', { length: 45 }), // IPv6 max length
  userAgent: text('user_agent'),
  // Timestamps
  consentedAt: timestamp('consented_at').defaultNow().notNull(),
  // Additional metadata
  metadata: jsonb('metadata').default({}).notNull(), // Additional context (signup source, etc.)
}, (table) => [
  index('consent_logs_user_id_idx').on(table.userId),
  index('consent_logs_email_idx').on(table.email),
  index('consent_logs_consent_type_idx').on(table.consentType),
  index('consent_logs_consented_at_idx').on(table.consentedAt),
]);

export const consentLogsRelations = relations(consentLogs, ({ one }) => ({
  user: one(users, {
    fields: [consentLogs.userId],
    references: [users.id],
  }),
}));

// =============================================================================
// GDPR Compliance - Audit Logs
// =============================================================================
// Records all API access for security auditing and compliance
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  // Who performed the action
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  orgId: uuid('org_id').references(() => orgs.id, { onDelete: 'set null' }),
  // What action was performed
  action: varchar('action', { length: 50 }).notNull(), // 'login', 'logout', 'read', 'create', 'update', 'delete', 'export'
  resource: varchar('resource', { length: 100 }).notNull(), // 'user', 'org', 'aws_account', 'resource', 'finding', etc.
  resourceId: varchar('resource_id', { length: 255 }),
  // HTTP request details
  method: varchar('method', { length: 10 }),
  path: varchar('path', { length: 500 }),
  statusCode: integer('status_code'),
  // Client information
  ipAddress: varchar('ip_address', { length: 45 }), // IPv6 max length
  userAgent: text('user_agent'),
  // Additional context
  details: jsonb('details').default({}),
  durationMs: integer('duration_ms'),
}, (table) => [
  index('audit_logs_timestamp_idx').on(table.timestamp),
  index('audit_logs_user_id_idx').on(table.userId),
  index('audit_logs_org_id_idx').on(table.orgId),
  index('audit_logs_action_idx').on(table.action),
  index('audit_logs_resource_idx').on(table.resource),
]);

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
  org: one(orgs, {
    fields: [auditLogs.orgId],
    references: [orgs.id],
  }),
}));

// =============================================================================
// GDPR Compliance - Data Retention Policies
// =============================================================================
// Configurable retention periods per organization and data type
export const retentionPolicies = pgTable('retention_policies', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').references(() => orgs.id, { onDelete: 'cascade' }),
  dataType: varchar('data_type', { length: 50 }).notNull(), // 'resources', 'findings', 'scans', 'audit_logs'
  retentionDays: integer('retention_days').notNull().default(365),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('retention_policies_org_data_type_idx').on(table.orgId, table.dataType),
]);

export const retentionPoliciesRelations = relations(retentionPolicies, ({ one }) => ({
  org: one(orgs, {
    fields: [retentionPolicies.orgId],
    references: [orgs.id],
  }),
}));

// =============================================================================
// GDPR Compliance - Data Deletion Requests (Right to Erasure)
// =============================================================================
// Tracks user data deletion requests per GDPR Article 17
export const dataDeletionRequests = pgTable('data_deletion_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  email: varchar('email', { length: 255 }).notNull(), // Stored in case user is deleted
  // Request details
  requestType: varchar('request_type', { length: 50 }).notNull(), // 'full_deletion', 'anonymization', 'data_export'
  status: varchar('status', { length: 50 }).default('pending').notNull(), // 'pending', 'processing', 'completed', 'cancelled'
  reason: text('reason'),
  // Processing timeline (GDPR requires response within 30 days)
  requestedAt: timestamp('requested_at').defaultNow().notNull(),
  processedAt: timestamp('processed_at'),
  scheduledDeletionAt: timestamp('scheduled_deletion_at'), // Grace period before actual deletion
  // Metadata
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  processedBy: uuid('processed_by').references(() => users.id, { onDelete: 'set null' }), // Admin who processed
  notes: text('notes'),
}, (table) => [
  index('data_deletion_requests_user_id_idx').on(table.userId),
  index('data_deletion_requests_status_idx').on(table.status),
  index('data_deletion_requests_requested_at_idx').on(table.requestedAt),
]);

export const dataDeletionRequestsRelations = relations(dataDeletionRequests, ({ one }) => ({
  user: one(users, {
    fields: [dataDeletionRequests.userId],
    references: [users.id],
  }),
  processedByUser: one(users, {
    fields: [dataDeletionRequests.processedBy],
    references: [users.id],
  }),
}));

// Type exports for use in services
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Org = typeof orgs.$inferSelect;
export type NewOrg = typeof orgs.$inferInsert;
export type UserOrgMember = typeof userOrgMembers.$inferSelect;
export type NewUserOrgMember = typeof userOrgMembers.$inferInsert;
export type AwsAccount = typeof awsAccounts.$inferSelect;
export type NewAwsAccount = typeof awsAccounts.$inferInsert;
export type Scan = typeof scans.$inferSelect;
export type NewScan = typeof scans.$inferInsert;
export type Resource = typeof resources.$inferSelect;
export type NewResource = typeof resources.$inferInsert;
export type Certificate = typeof certificates.$inferSelect;
export type NewCertificate = typeof certificates.$inferInsert;
export type Finding = typeof findings.$inferSelect;
export type NewFinding = typeof findings.$inferInsert;
export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;
export type ConsentLog = typeof consentLogs.$inferSelect;
export type NewConsentLog = typeof consentLogs.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
export type RetentionPolicy = typeof retentionPolicies.$inferSelect;
export type NewRetentionPolicy = typeof retentionPolicies.$inferInsert;
export type DataDeletionRequest = typeof dataDeletionRequests.$inferSelect;
export type NewDataDeletionRequest = typeof dataDeletionRequests.$inferInsert;
