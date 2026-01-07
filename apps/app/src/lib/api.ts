import { randomDelay } from "./utils";

// Set to true to bypass auth and use mock admin user
const DEV_BYPASS_AUTH = true;

import {
  mockUser,
  mockOrg,
  mockAwsAccounts,
  mockResources,
  mockCertificates,
  mockFindings,
  mockScans,
  mockDashboardSummary,
  mockRecommendedActions,
} from "./mock-data";
import type {
  User,
  Org,
  AwsAccount,
  Resource,
  Certificate,
  Finding,
  Scan,
  DashboardSummary,
  LoginCredentials,
  SignupCredentials,
  AuthResponse,
  CreateAwsAccountInput,
  ConnectAwsRoleInput,
  TestConnectionResult,
  FindingFilters,
  ResourceFilters,
  FindingStatus,
} from "@/types";
import type { RecommendedAction } from "./mock-data";

// Simulated local storage for auth state
const AUTH_TOKEN_KEY = "scanorbit_token";
const AUTH_USER_KEY = "scanorbit_user";

// Helper to check if user is "authenticated"
function isAuthenticated(): boolean {
  return !!localStorage.getItem(AUTH_TOKEN_KEY);
}

function requireAuth(): void {
  if (DEV_BYPASS_AUTH) return;
  if (!isAuthenticated()) {
    throw new Error("Unauthorized");
  }
}

// ============================================
// Auth API
// ============================================

export async function login(credentials: LoginCredentials): Promise<AuthResponse> {
  await randomDelay();

  // Simulate validation
  if (!credentials.email || !credentials.password) {
    throw new Error("Email and password are required");
  }

  if (credentials.password.length < 8) {
    throw new Error("Invalid credentials");
  }

  const token = "mock_jwt_token_" + Date.now();
  const user = { ...mockUser, email: credentials.email };

  localStorage.setItem(AUTH_TOKEN_KEY, token);
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));

  return { user, org: mockOrg, token };
}

export async function signup(credentials: SignupCredentials): Promise<AuthResponse> {
  await randomDelay();

  // Simulate validation
  if (!credentials.email || !credentials.password) {
    throw new Error("Email and password are required");
  }

  if (credentials.password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }

  const token = "mock_jwt_token_" + Date.now();
  const user: User = {
    id: "user_new_" + Date.now(),
    email: credentials.email,
    name: credentials.name || credentials.email.split("@")[0],
    createdAt: new Date().toISOString(),
  };

  localStorage.setItem(AUTH_TOKEN_KEY, token);
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));

  // New user doesn't have an org yet
  return { user, org: null, token };
}

export async function logout(): Promise<void> {
  await randomDelay(200, 500);
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
}

export async function getMe(): Promise<{ user: User; org: Org | null }> {
  await randomDelay(300, 800);

  // Dev bypass: auto-authenticate as admin with org
  if (DEV_BYPASS_AUTH) {
    return { user: mockUser, org: mockOrg };
  }

  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (!token) {
    throw new Error("Unauthorized");
  }

  const userStr = localStorage.getItem(AUTH_USER_KEY);
  const user = userStr ? JSON.parse(userStr) : mockUser;

  // Check if user has completed onboarding (has org)
  const hasOrg = localStorage.getItem("scanorbit_has_org") === "true";

  return { user, org: hasOrg ? mockOrg : null };
}

// ============================================
// Organization API
// ============================================

export async function createOrganization(name: string): Promise<Org> {
  await randomDelay();
  requireAuth();

  if (!name || name.trim().length < 2) {
    throw new Error("Organization name must be at least 2 characters");
  }

  const org: Org = {
    id: "org_" + Date.now(),
    name: name.trim(),
    createdAt: new Date().toISOString(),
  };

  localStorage.setItem("scanorbit_has_org", "true");

  return org;
}

// ============================================
// AWS Accounts API
// ============================================

export async function getAwsAccounts(): Promise<AwsAccount[]> {
  await randomDelay();
  requireAuth();
  return [...mockAwsAccounts];
}

export async function getAwsAccount(id: string): Promise<AwsAccount | null> {
  await randomDelay();
  requireAuth();
  return mockAwsAccounts.find((a) => a.id === id) || null;
}

export async function createAwsAccount(input: CreateAwsAccountInput): Promise<AwsAccount> {
  await randomDelay();
  requireAuth();

  if (!input.name || !input.awsAccountId) {
    throw new Error("Name and AWS Account ID are required");
  }

  if (!/^\d{12}$/.test(input.awsAccountId)) {
    throw new Error("AWS Account ID must be a 12-digit number");
  }

  const account: AwsAccount = {
    id: "aws_new_" + Date.now(),
    orgId: mockOrg.id,
    name: input.name,
    awsAccountId: input.awsAccountId,
    roleArn: "",
    status: "pending",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return account;
}

export async function connectAwsRole(
  accountId: string,
  input: ConnectAwsRoleInput
): Promise<AwsAccount> {
  await randomDelay();
  requireAuth();

  if (!input.roleArn) {
    throw new Error("Role ARN is required");
  }

  if (!input.roleArn.startsWith("arn:aws:iam::")) {
    throw new Error("Invalid Role ARN format");
  }

  const account = mockAwsAccounts.find((a) => a.id === accountId);
  if (!account) {
    throw new Error("Account not found");
  }

  return {
    ...account,
    roleArn: input.roleArn,
    externalId: input.externalId,
    status: "ok",
    updatedAt: new Date().toISOString(),
  };
}

export async function testAwsConnection(_accountId: string): Promise<TestConnectionResult> {
  await randomDelay(1000, 2000);
  requireAuth();

  // Simulate 90% success rate
  const success = Math.random() > 0.1;

  if (success) {
    return {
      success: true,
      message: "Successfully connected to AWS account",
      regions: ["eu-west-1", "eu-central-1", "us-east-1", "us-west-2"],
    };
  }

  return {
    success: false,
    message: "Failed to assume role. Please check the Role ARN and trust policy.",
  };
}

export async function disconnectAwsAccount(_accountId: string): Promise<void> {
  await randomDelay();
  requireAuth();
  // In real app, this would remove the account
}

// ============================================
// Scans API
// ============================================

export async function triggerScan(awsAccountId: string): Promise<Scan> {
  await randomDelay();
  requireAuth();

  return {
    id: "scan_new_" + Date.now(),
    awsAccountId,
    status: "queued",
    progress: 0,
    startedAt: new Date().toISOString(),
  };
}

export async function getScanStatus(scanId: string): Promise<Scan> {
  await randomDelay(500, 1000);
  requireAuth();

  // Simulate scan progress
  const existingScan = mockScans.find((s) => s.id === scanId);
  if (existingScan) {
    return existingScan;
  }

  // For new scans, simulate progress
  const progressKey = `scan_progress_${scanId}`;
  let progress = parseInt(localStorage.getItem(progressKey) || "0", 10);
  progress = Math.min(100, progress + Math.floor(Math.random() * 20) + 10);
  localStorage.setItem(progressKey, progress.toString());

  const steps = [
    "Discovering EC2 instances...",
    "Scanning EBS volumes...",
    "Checking RDS databases...",
    "Analyzing S3 buckets...",
    "Inspecting load balancers...",
    "Reviewing SSL certificates...",
    "Detecting orphaned resources...",
    "Analyzing data residency...",
    "Finalizing results...",
  ];

  const stepIndex = Math.floor((progress / 100) * steps.length);
  const currentStep = progress < 100 ? steps[Math.min(stepIndex, steps.length - 1)] : undefined;

  return {
    id: scanId,
    awsAccountId: "aws_1",
    status: progress >= 100 ? "completed" : "running",
    progress,
    currentStep,
    resourcesDiscovered: progress >= 100 ? 15 : Math.floor(progress / 10),
    findingsCount: progress >= 100 ? 8 : Math.floor(progress / 20),
    startedAt: new Date(Date.now() - 60000).toISOString(),
    completedAt: progress >= 100 ? new Date().toISOString() : undefined,
  };
}

export async function getScanHistory(awsAccountId: string): Promise<Scan[]> {
  await randomDelay();
  requireAuth();
  return mockScans.filter((s) => s.awsAccountId === awsAccountId);
}

// ============================================
// Resources API
// ============================================

export async function getResources(filters?: ResourceFilters): Promise<Resource[]> {
  await randomDelay();
  requireAuth();

  let resources = [...mockResources];

  if (filters) {
    if (filters.service) {
      resources = resources.filter((r) => r.service === filters.service);
    }
    if (filters.region) {
      resources = resources.filter((r) => r.region === filters.region);
    }
    if (filters.awsAccountId) {
      resources = resources.filter((r) => r.awsAccountId === filters.awsAccountId);
    }
    if (filters.state) {
      resources = resources.filter((r) => r.state === filters.state);
    }
    if (filters.search) {
      const search = filters.search.toLowerCase();
      resources = resources.filter(
        (r) =>
          r.name.toLowerCase().includes(search) ||
          r.resourceId.toLowerCase().includes(search)
      );
    }
  }

  return resources;
}

export async function getResource(id: string): Promise<Resource | null> {
  await randomDelay();
  requireAuth();
  return mockResources.find((r) => r.id === id) || null;
}

// ============================================
// Findings API
// ============================================

export async function getFindings(filters?: FindingFilters): Promise<Finding[]> {
  await randomDelay();
  requireAuth();

  let findings = [...mockFindings];

  if (filters) {
    if (filters.type) {
      findings = findings.filter((f) => f.type === filters.type);
    }
    if (filters.severity) {
      findings = findings.filter((f) => f.severity === filters.severity);
    }
    if (filters.status) {
      findings = findings.filter((f) => f.status === filters.status);
    }
    if (filters.awsAccountId) {
      findings = findings.filter((f) => f.awsAccountId === filters.awsAccountId);
    }
    if (filters.search) {
      const search = filters.search.toLowerCase();
      findings = findings.filter(
        (f) =>
          f.summary.toLowerCase().includes(search) ||
          f.details.description.toLowerCase().includes(search)
      );
    }
  }

  return findings;
}

export async function getFinding(id: string): Promise<Finding | null> {
  await randomDelay();
  requireAuth();
  return mockFindings.find((f) => f.id === id) || null;
}

export async function updateFindingStatus(
  id: string,
  status: FindingStatus,
  snoozeDays?: number
): Promise<Finding> {
  await randomDelay();
  requireAuth();

  const finding = mockFindings.find((f) => f.id === id);
  if (!finding) {
    throw new Error("Finding not found");
  }

  const updated: Finding = {
    ...finding,
    status,
    resolvedAt: status === "resolved" ? new Date().toISOString() : undefined,
    resolvedBy: status === "resolved" ? mockUser.email : undefined,
    snoozedUntil:
      status === "snoozed" && snoozeDays
        ? new Date(Date.now() + snoozeDays * 86400000).toISOString()
        : undefined,
  };

  return updated;
}

// ============================================
// Certificates API
// ============================================

export async function getCertificates(): Promise<Certificate[]> {
  await randomDelay();
  requireAuth();
  return [...mockCertificates];
}

export async function getCertificate(id: string): Promise<Certificate | null> {
  await randomDelay();
  requireAuth();
  return mockCertificates.find((c) => c.id === id) || null;
}

// ============================================
// Dashboard API
// ============================================

export async function getDashboardSummary(): Promise<DashboardSummary> {
  await randomDelay();
  requireAuth();
  return { ...mockDashboardSummary };
}

export async function getRecommendedActions(): Promise<RecommendedAction[]> {
  await randomDelay();
  requireAuth();
  return [...mockRecommendedActions];
}

// ============================================
// Settings API
// ============================================

export async function updateProfile(data: { name?: string; email?: string }): Promise<User> {
  await randomDelay();
  requireAuth();

  const userStr = localStorage.getItem(AUTH_USER_KEY);
  const user = userStr ? JSON.parse(userStr) : mockUser;

  const updated = {
    ...user,
    ...data,
  };

  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(updated));

  return updated;
}

export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<void> {
  await randomDelay();
  requireAuth();

  if (currentPassword.length < 8) {
    throw new Error("Current password is incorrect");
  }

  if (newPassword.length < 8) {
    throw new Error("New password must be at least 8 characters");
  }

  // In real app, this would update the password
}

export async function updateOrganization(data: { name: string }): Promise<Org> {
  await randomDelay();
  requireAuth();

  return {
    ...mockOrg,
    name: data.name,
  };
}
