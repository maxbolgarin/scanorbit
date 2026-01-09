import axios, { AxiosError } from "axios";
import type {
  User,
  Org,
  OrgMember,
  AwsAccount,
  Resource,
  Finding,
  Scan,
  LoginCredentials,
  SignupCredentials,
  LoginResponse,
  SignupResponse,
  MeResponse,
  CreateAwsAccountInput,
  TestConnectionResult,
  FindingFilters,
  ResourceFilters,
  FindingStatus,
  PaginatedResponse,
  ResourceStats,
  FindingStats,
} from "@/types";

// API base URL from environment.
//
// Prefer same-origin `/api` so the SPA can be deployed behind a reverse proxy (nginx)
// without relying on build-time env wiring, and so local dev can use Vite's proxy.
const API_URL = import.meta.env.VITE_API_URL || "/api";

// Create axios instance with default config
const api = axios.create({
  baseURL: API_URL,
  withCredentials: true, // Send cookies with requests
  headers: {
    "Content-Type": "application/json",
  },
});

// Error handler helper
function handleApiError(error: unknown): never {
  if (error instanceof AxiosError) {
    const data = error.response?.data;

    // Handle validation errors with details array
    if (data?.details && Array.isArray(data.details)) {
      const messages = data.details.map((d: { message?: string }) => d.message).filter(Boolean);
      throw new Error(messages.join(', ') || data.message || 'Validation failed');
    }

    // Handle standard error responses
    const message = typeof data?.message === 'string'
      ? data.message
      : typeof data?.error === 'string'
        ? data.error
        : error.message;
    throw new Error(message);
  }
  throw error;
}

// ============================================
// Auth API
// ============================================

export async function login(credentials: LoginCredentials): Promise<LoginResponse> {
  try {
    const { data } = await api.post<LoginResponse>("/auth/login", credentials);
    return data;
  } catch (error) {
    handleApiError(error);
  }
}

export async function signup(credentials: SignupCredentials): Promise<SignupResponse> {
  try {
    const { data } = await api.post<SignupResponse>("/auth/signup", credentials);
    return data;
  } catch (error) {
    handleApiError(error);
  }
}

export async function logout(): Promise<void> {
  try {
    await api.post("/auth/logout");
  } catch (error) {
    handleApiError(error);
  }
}

export async function getMe(): Promise<MeResponse> {
  try {
    const { data } = await api.get<MeResponse>("/auth/me");
    return data;
  } catch (error) {
    handleApiError(error);
  }
}

export async function switchOrg(orgId: string): Promise<{ token: string }> {
  try {
    const { data } = await api.post<{ token: string }>("/auth/switch-org", { orgId });
    return data;
  } catch (error) {
    handleApiError(error);
  }
}

// ============================================
// New Signup Flow API
// ============================================

export async function sendVerificationCode(email: string): Promise<{ success: boolean; message: string }> {
  try {
    const { data } = await api.post<{ success: boolean; message: string }>("/auth/send-code", { email });
    return data;
  } catch (error) {
    handleApiError(error);
  }
}

export async function verifyCode(email: string, code: string): Promise<{ success: boolean; signupToken: string }> {
  try {
    const { data } = await api.post<{ success: boolean; signupToken: string }>("/auth/verify-code", { email, code });
    return data;
  } catch (error) {
    handleApiError(error);
  }
}

export async function completeSignup(signupToken: string, password: string): Promise<{ user: User; token: string }> {
  try {
    const { data } = await api.post<{ user: User; token: string }>("/auth/complete-signup", { signupToken, password });
    return data;
  } catch (error) {
    handleApiError(error);
  }
}

export async function resendVerificationCode(email: string): Promise<{ success: boolean; message: string }> {
  try {
    const { data } = await api.post<{ success: boolean; message: string }>("/auth/resend-code", { email });
    return data;
  } catch (error) {
    handleApiError(error);
  }
}

export type JobTitle = 'devops' | 'cto' | 'developer' | 'security' | 'personal' | 'other';

export async function createOrg(input: {
  orgName: string;
  fullName?: string;
  title?: JobTitle;
}): Promise<{ org: Org; token: string }> {
  try {
    const { data } = await api.post<{ data: Org; token: string }>("/orgs", input);
    return { org: data.data, token: data.token };
  } catch (error) {
    handleApiError(error);
  }
}

// ============================================
// Organization API
// ============================================

export async function getOrgs(): Promise<Org[]> {
  try {
    const { data } = await api.get<{ data: Org[] }>("/orgs");
    return data.data;
  } catch (error) {
    handleApiError(error);
  }
}

export async function getOrg(orgId: string): Promise<Org> {
  try {
    const { data } = await api.get<{ data: Org }>(`/orgs/${orgId}`);
    return data.data;
  } catch (error) {
    handleApiError(error);
  }
}

export async function updateOrganization(updates: { name?: string; logoUrl?: string }): Promise<Org> {
  try {
    // Get current org from the first org (simplified - in real app you'd track active org)
    const orgs = await getOrgs();
    if (orgs.length === 0) throw new Error("No organization found");
    const { data } = await api.patch<{ data: Org }>(`/orgs/${orgs[0].id}`, updates);
    return data.data;
  } catch (error) {
    handleApiError(error);
  }
}

export async function getOrgMembers(orgId: string): Promise<OrgMember[]> {
  try {
    const { data } = await api.get<{ data: OrgMember[] }>(`/orgs/${orgId}/members`);
    return data.data;
  } catch (error) {
    handleApiError(error);
  }
}

// ============================================
// AWS Accounts API
// ============================================

export async function getAwsAccounts(): Promise<AwsAccount[]> {
  try {
    const { data } = await api.get<{ data: AwsAccount[] }>("/aws/accounts");
    return data.data;
  } catch (error) {
    handleApiError(error);
  }
}

export async function getAwsAccount(accountId: string): Promise<AwsAccount> {
  try {
    const { data } = await api.get<{ data: AwsAccount }>(`/aws/accounts/${accountId}`);
    return data.data;
  } catch (error) {
    handleApiError(error);
  }
}

export async function createAwsAccount(input: CreateAwsAccountInput): Promise<AwsAccount> {
  try {
    const { data } = await api.post<{ data: AwsAccount }>("/aws/accounts", input);
    return data.data;
  } catch (error) {
    handleApiError(error);
  }
}

export async function deleteAwsAccount(accountId: string): Promise<void> {
  try {
    await api.delete(`/aws/accounts/${accountId}`);
  } catch (error) {
    handleApiError(error);
  }
}

export async function testAwsConnection(accountId: string): Promise<TestConnectionResult> {
  try {
    const { data } = await api.post<{ data: TestConnectionResult }>(`/aws/accounts/${accountId}/test`);
    return data.data;
  } catch (error) {
    handleApiError(error);
  }
}

export async function triggerScan(accountId: string): Promise<Scan> {
  try {
    const { data } = await api.post<{ data: Scan }>(`/aws/accounts/${accountId}/scan`);
    return data.data;
  } catch (error) {
    handleApiError(error);
  }
}

export async function getScanHistory(accountId: string): Promise<Scan[]> {
  try {
    const { data } = await api.get<{ data: Scan[] }>(`/aws/accounts/${accountId}/scans`);
    return data.data;
  } catch (error) {
    handleApiError(error);
  }
}

export async function getScan(scanId: string): Promise<Scan> {
  try {
    const { data } = await api.get<{ data: Scan }>(`/aws/scans/${scanId}`);
    return data.data;
  } catch (error) {
    handleApiError(error);
  }
}

export async function getActiveScans(): Promise<Scan[]> {
  try {
    const { data } = await api.get<{ data: Scan[] }>("/aws/scans/active");
    return data.data;
  } catch (error) {
    handleApiError(error);
  }
}

export async function getRecentScans(limit: number = 10): Promise<Scan[]> {
  try {
    const { data } = await api.get<{ data: Scan[] }>(`/aws/scans/recent?limit=${limit}`);
    return data.data;
  } catch (error) {
    handleApiError(error);
  }
}

// ============================================
// Resources API
// ============================================

export async function getResources(filters?: ResourceFilters): Promise<PaginatedResponse<Resource>> {
  try {
    const params = new URLSearchParams();
    if (filters?.awsAccountId) params.set("awsAccountId", filters.awsAccountId);
    if (filters?.region) params.set("region", filters.region);
    if (filters?.service) params.set("service", filters.service);
    if (filters?.state) params.set("state", filters.state);
    if (filters?.page) params.set("page", String(filters.page));
    if (filters?.limit) params.set("limit", String(filters.limit));

    const { data } = await api.get<PaginatedResponse<Resource>>(`/resources?${params.toString()}`);
    return data;
  } catch (error) {
    handleApiError(error);
  }
}

export async function getResource(resourceId: string): Promise<Resource> {
  try {
    const { data } = await api.get<{ data: Resource }>(`/resources/${resourceId}`);
    return data.data;
  } catch (error) {
    handleApiError(error);
  }
}

export async function getResourceStats(): Promise<ResourceStats> {
  try {
    const { data } = await api.get<{ data: ResourceStats }>("/resources/stats");
    return data.data;
  } catch (error) {
    handleApiError(error);
  }
}

export async function getDistinctRegions(): Promise<string[]> {
  try {
    const { data } = await api.get<{ data: string[] }>("/resources/regions");
    return data.data;
  } catch (error) {
    handleApiError(error);
  }
}

export async function getDistinctServices(): Promise<string[]> {
  try {
    const { data } = await api.get<{ data: string[] }>("/resources/services");
    return data.data;
  } catch (error) {
    handleApiError(error);
  }
}

// ============================================
// Findings API
// ============================================

export async function getFindings(filters?: FindingFilters): Promise<PaginatedResponse<Finding>> {
  try {
    const params = new URLSearchParams();
    if (filters?.awsAccountId) params.set("awsAccountId", filters.awsAccountId);
    if (filters?.type) params.set("type", filters.type);
    if (filters?.severity) params.set("severity", filters.severity);
    if (filters?.status) params.set("status", filters.status);
    if (filters?.page) params.set("page", String(filters.page));
    if (filters?.limit) params.set("limit", String(filters.limit));

    const { data } = await api.get<PaginatedResponse<Finding>>(`/findings?${params.toString()}`);
    return data;
  } catch (error) {
    handleApiError(error);
  }
}

export async function getFinding(findingId: string): Promise<Finding> {
  try {
    const { data } = await api.get<{ data: Finding }>(`/findings/${findingId}`);
    return data.data;
  } catch (error) {
    handleApiError(error);
  }
}

export async function getFindingStats(): Promise<FindingStats> {
  try {
    const { data } = await api.get<{ data: FindingStats }>("/findings/stats");
    return data.data;
  } catch (error) {
    handleApiError(error);
  }
}

export async function updateFindingStatus(
  findingId: string,
  status: FindingStatus,
  snoozedUntil?: Date
): Promise<Finding> {
  try {
    const { data } = await api.patch<{ data: Finding }>(`/findings/${findingId}`, {
      status,
      snoozedUntil,
    });
    return data.data;
  } catch (error) {
    handleApiError(error);
  }
}

export async function bulkUpdateFindingStatus(
  findingIds: string[],
  status: FindingStatus
): Promise<{ updatedCount: number }> {
  try {
    const { data } = await api.post<{ data: { updatedCount: number } }>("/findings/bulk-update", {
      findingIds,
      status,
    });
    return data.data;
  } catch (error) {
    handleApiError(error);
  }
}

// ============================================
// Dashboard API (computed from other endpoints)
// ============================================

export async function getDashboardSummary(): Promise<{
  totalResources: number;
  resourcesTrend: number;
  orphanedResources: number;
  orphanedSavings: number;
  expiringCertificates: number;
  urgentCertificates: number;
  residencyViolations: number;
}> {
  try {
    // Fetch stats from backend
    const [resourceStats, findingStats] = await Promise.all([
      getResourceStats(),
      getFindingStats(),
    ]);

    // Compute dashboard metrics from stats
    const orphanedCount =
      (findingStats.byType["orphaned_volume"] || 0) +
      (findingStats.byType["orphaned_eip"] || 0) +
      (findingStats.byType["orphaned_snapshot"] || 0);

    return {
      totalResources: resourceStats.totalCount,
      resourcesTrend: 0, // Would need historical data
      orphanedResources: orphanedCount,
      orphanedSavings: 0, // Would need to compute from findings details
      expiringCertificates: findingStats.byType["ssl_expiry"] || 0,
      urgentCertificates: 0, // Would need to filter by urgency
      residencyViolations: findingStats.byType["data_residency_violation"] || 0,
    };
  } catch (error) {
    handleApiError(error);
  }
}

export async function getRecommendedActions(): Promise<Finding[]> {
  try {
    // Get open findings sorted by severity
    const { data: findings } = await getFindings({
      status: "open",
      limit: 10,
    });

    // Sort by severity (high first)
    const severityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    return findings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  } catch (error) {
    handleApiError(error);
  }
}

// ============================================
// Profile API
// ============================================

export async function updateProfile(_updates: { name?: string; email?: string }): Promise<User> {
  // Note: Backend doesn't have a profile update endpoint yet
  // This would need to be implemented on the backend
  throw new Error("Profile update not implemented on backend");
}

export async function changePassword(_currentPassword: string, _newPassword: string): Promise<void> {
  // Note: Backend doesn't have a password change endpoint yet
  // This would need to be implemented on the backend
  throw new Error("Password change not implemented on backend");
}
