import crypto from 'crypto';

export function createUser(overrides: Record<string, unknown> = {}) {
  return {
    id: crypto.randomUUID(),
    email: `test-${Date.now()}@example.com`,
    passwordHash: '$2b$10$hashedpasswordplaceholder',
    fullName: 'Test User',
    emailVerified: true,
    twoFactorEnabled: false,
    twoFactorSecret: null,
    recoveryCodes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function createOrg(overrides: Record<string, unknown> = {}) {
  return {
    id: crypto.randomUUID(),
    name: 'Test Org',
    slug: `test-org-${Date.now()}`,
    logoUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function createOrgMember(overrides: Record<string, unknown> = {}) {
  return {
    id: crypto.randomUUID(),
    userId: crypto.randomUUID(),
    orgId: crypto.randomUUID(),
    role: 'admin' as const,
    title: null,
    createdAt: new Date(),
    ...overrides,
  };
}

export function createAwsAccount(overrides: Record<string, unknown> = {}) {
  return {
    id: crypto.randomUUID(),
    orgId: crypto.randomUUID(),
    name: 'Test AWS Account',
    awsAccountId: '123456789012',
    roleArn: 'arn:aws:iam::123456789012:role/ScanOrbitRole',
    externalId: 'test-external-id',
    status: 'ok' as const,
    statusMessage: null,
    enabledScanners: ['ec2', 'rds', 's3'],
    lastScanAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function createScan(overrides: Record<string, unknown> = {}) {
  return {
    id: crypto.randomUUID(),
    orgId: crypto.randomUUID(),
    awsAccountId: crypto.randomUUID(),
    status: 'complete' as const,
    resourcesDiscovered: 10,
    resourcesDelta: 2,
    findingsNew: 3,
    findingsResolved: 1,
    startedAt: new Date(),
    completedAt: new Date(),
    createdAt: new Date(),
    ...overrides,
  };
}

export function createResource(overrides: Record<string, unknown> = {}) {
  return {
    id: crypto.randomUUID(),
    orgId: crypto.randomUUID(),
    awsAccountId: crypto.randomUUID(),
    resourceId: `arn:aws:ec2:eu-central-1:123456789012:instance/i-${Date.now()}`,
    service: 'ec2' as const,
    resourceType: 'instance',
    name: 'test-instance',
    region: 'eu-central-1',
    state: 'running',
    tags: {},
    costEstimateMonthly: '25.00',
    raw: {},
    firstSeenAt: new Date(),
    lastSeenAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function createFinding(overrides: Record<string, unknown> = {}) {
  return {
    id: crypto.randomUUID(),
    orgId: crypto.randomUUID(),
    awsAccountId: crypto.randomUUID(),
    resourceId: crypto.randomUUID(),
    certificateId: null,
    type: 'orphaned_volume' as const,
    severity: 'medium' as const,
    status: 'open' as const,
    title: 'Orphaned EBS Volume',
    description: 'Volume is not attached to any instance',
    recommendation: 'Delete the volume or attach it to an instance',
    details: {},
    detectionCount: 1,
    firstDetectedAt: new Date(),
    lastDetectedAt: new Date(),
    snoozedUntil: null,
    resolvedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function createOrgInvitation(overrides: Record<string, unknown> = {}) {
  return {
    id: crypto.randomUUID(),
    orgId: crypto.randomUUID(),
    email: `invite-${Date.now()}@example.com`,
    role: 'member' as const,
    invitedBy: crypto.randomUUID(),
    token: crypto.randomUUID(),
    status: 'pending' as const,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
    ...overrides,
  };
}

export function createJob(overrides: Record<string, unknown> = {}) {
  return {
    id: crypto.randomUUID(),
    scanId: crypto.randomUUID(),
    type: 'scan_account' as const,
    payload: {},
    status: 'queued' as const,
    error: null,
    retries: 0,
    recoveryCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}
