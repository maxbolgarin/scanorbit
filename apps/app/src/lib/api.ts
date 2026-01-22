import axios, { AxiosError } from "axios";
import type {
  User,
  Org,
  OrgMember,
  OrgSettings,
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
  FindingType,
  PaginatedResponse,
  ResourceStats,
  FindingStats,
  DependencyWithResource,
  DependentWithResource,
  ResourceScanHistory,
  EnhancedDashboardSummary,
  FindingScanHistory,
  FindingTimelineEntry,
  SubscriptionTier,
  SubscriptionStatus,
  CheckoutSession,
  PortalSession,
} from "@/types";

function normalizeApiUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const v = value.trim();
  if (!v) return undefined;

  // Already absolute (or scheme-relative) URL
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(v) || v.startsWith("//")) return v;

  // Same-origin proxy path
  if (v.startsWith("/")) return v;

  // Bare host (e.g. "api.scanorbit.cloud" or "localhost:4000") → add scheme
  const host = v.split("/")[0];
  const isLocal =
    host === "localhost" ||
    host.startsWith("localhost:") ||
    host === "127.0.0.1" ||
    host.startsWith("127.0.0.1:") ||
    host === "0.0.0.0" ||
    host.startsWith("0.0.0.0:") ||
    host === "[::1]" ||
    host.startsWith("[::1]:");

  return `${isLocal ? "http" : "https"}://${v}`;
}

// API base URL from environment.
//
// Prefer same-origin `/api` so the SPA can be deployed behind a reverse proxy (nginx)
// without relying on build-time env wiring, and so local dev can use Vite's proxy.
//
// Also normalize accidental values like "api.scanorbit.cloud" (missing scheme), which
// would otherwise be treated as a relative path ("/api.scanorbit.cloud/...") by the browser.
const API_URL = normalizeApiUrl(import.meta.env.VITE_API_URL) || "/api";

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
  console.error("API Error:", error);
  if (error instanceof AxiosError) {
    const data = error.response?.data;
    console.log("API Error response data:", data);

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
    console.log("Throwing error with message:", message);
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
// Password Reset API
// ============================================

export async function requestPasswordReset(email: string): Promise<{ message: string }> {
  try {
    const { data } = await api.post<{ message: string }>("/auth/forgot-password", { email });
    return data;
  } catch (error) {
    handleApiError(error);
  }
}

export async function resetPassword(token: string, password: string): Promise<{ message: string }> {
  try {
    const { data } = await api.post<{ message: string }>("/auth/reset-password", { token, password });
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

export async function completeSignup(signupToken: string, password: string, consent: boolean): Promise<{ user: User; token: string }> {
  try {
    const { data } = await api.post<{ user: User; token: string }>("/auth/complete-signup", { signupToken, password, consent });
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

export async function getOrgSettings(orgId: string): Promise<OrgSettings> {
  try {
    const { data } = await api.get<{ data: OrgSettings }>(`/orgs/${orgId}/settings`);
    return data.data;
  } catch (error) {
    handleApiError(error);
  }
}

export async function updateOrgSettings(
  orgId: string,
  settings: Partial<OrgSettings>
): Promise<OrgSettings> {
  try {
    const { data } = await api.patch<{ data: OrgSettings }>(`/orgs/${orgId}/settings`, settings);
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

export async function updateAwsAccountScanners(
  accountId: string,
  enabledScanners: string[]
): Promise<AwsAccount> {
  try {
    const { data } = await api.patch<{ data: AwsAccount }>(
      `/aws/accounts/${accountId}/scanners`,
      { enabledScanners }
    );
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

export async function getRecentScans(
  limit: number = 10,
  includeArchived: boolean = false
): Promise<Scan[]> {
  try {
    const { data } = await api.get<{ data: Scan[] }>(
      `/aws/scans/recent?limit=${limit}&includeArchived=${includeArchived}`
    );
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
    if (filters?.costFilter) params.set("costFilter", filters.costFilter);
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

export async function getResourceStats(filters?: { awsAccountId?: string }): Promise<ResourceStats> {
  try {
    const params = new URLSearchParams();
    if (filters?.awsAccountId) params.set("awsAccountId", filters.awsAccountId);
    const queryString = params.toString();
    const { data } = await api.get<{ data: ResourceStats }>(`/resources/stats${queryString ? `?${queryString}` : ""}`);
    return data.data;
  } catch (error) {
    handleApiError(error);
  }
}

export async function getResourceHealth(filters?: { awsAccountId?: string }): Promise<{ total: number; healthy: number; warning: number; critical: number }> {
  try {
    const params = new URLSearchParams();
    if (filters?.awsAccountId) params.set("awsAccountId", filters.awsAccountId);
    const queryString = params.toString();
    const { data } = await api.get<{ data: { total: number; healthy: number; warning: number; critical: number } }>(`/resources/health${queryString ? `?${queryString}` : ""}`);
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

export async function getResourceDependencies(resourceId: string): Promise<DependencyWithResource[]> {
  try {
    const { data } = await api.get<{ data: DependencyWithResource[] }>(`/resources/${resourceId}/dependencies`);
    return data.data;
  } catch (error) {
    handleApiError(error);
  }
}

export async function getResourceDependents(resourceId: string): Promise<DependentWithResource[]> {
  try {
    const { data } = await api.get<{ data: DependentWithResource[] }>(`/resources/${resourceId}/dependents`);
    return data.data;
  } catch (error) {
    handleApiError(error);
  }
}

export async function getResourceScanHistory(resourceId: string): Promise<ResourceScanHistory[]> {
  try {
    const { data } = await api.get<{ data: ResourceScanHistory[] }>(`/resources/${resourceId}/scan-history`);
    return data.data;
  } catch (error) {
    handleApiError(error);
  }
}

/**
 * Dependency as stored in the database
 */
export interface DBDependency {
  id: string;
  orgId: string;
  sourceResourceId: string;
  targetResourceId: string;
  targetService: string;
  relationshipType: string;
  createdAt: string;
}

export async function getAllDependencies(): Promise<DBDependency[]> {
  try {
    const { data } = await api.get<{ data: DBDependency[] }>("/resources/dependencies/all");
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

export async function getFindingStats(filters?: { awsAccountId?: string }): Promise<FindingStats> {
  try {
    const params = new URLSearchParams();
    if (filters?.awsAccountId) params.set("awsAccountId", filters.awsAccountId);
    const queryString = params.toString();
    const { data } = await api.get<{ data: FindingStats }>(`/findings/stats${queryString ? `?${queryString}` : ""}`);
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

export async function getFindingHistory(findingId: string): Promise<FindingScanHistory[]> {
  try {
    const { data } = await api.get<{ data: FindingScanHistory[] }>(`/findings/${findingId}/history`);
    return data.data;
  } catch (error) {
    handleApiError(error);
  }
}

export async function getResourceFindingTimeline(resourceId: string): Promise<FindingTimelineEntry[]> {
  try {
    const { data } = await api.get<{ data: FindingTimelineEntry[] }>(`/resources/${resourceId}/finding-timeline`);
    return data.data;
  } catch (error) {
    handleApiError(error);
  }
}

// ============================================
// Dashboard API (computed from other endpoints)
// ============================================

export async function getDashboardSummary(filters?: { awsAccountId?: string }): Promise<{
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
      getResourceStats(filters),
      getFindingStats(filters),
    ]);

    // Compute dashboard metrics from stats
    // Count all orphaned/unused/idle resources
    const orphanedCount =
      (findingStats.byType["orphaned_volume"] || 0) +
      (findingStats.byType["orphaned_eip"] || 0) +
      (findingStats.byType["orphaned_snapshot"] || 0) +
      (findingStats.byType["orphaned_eni"] || 0) +
      (findingStats.byType["idle_load_balancer"] || 0) +
      (findingStats.byType["idle_nat_gateway"] || 0) +
      (findingStats.byType["unused_security_group"] || 0);

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

export async function getRecommendedActions(filters?: { awsAccountId?: string }): Promise<Finding[]> {
  try {
    // Get open findings sorted by severity
    const { data: findings } = await getFindings({
      status: "open",
      limit: 10,
      awsAccountId: filters?.awsAccountId,
    });

    // Sort by severity (high first)
    const severityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    return findings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  } catch (error) {
    handleApiError(error);
  }
}

// Helper: Calculate health score from metrics
function calculateHealthScores(
  findingStats: FindingStats,
  resourceStats: ResourceStats,
  orphanedCount: number,
  residencyViolations: number,
  expiringCerts: number
): { overall: number; security: number; compliance: number; costEfficiency: number } {
  const totalResources = resourceStats.totalCount || 1; // Avoid division by zero

  // Security score (40% weight): Based on finding severity
  // Penalize: critical -20, high -10, medium -5, low -2 per finding (max penalty 100)
  const criticalFindings = findingStats.bySeverity["critical"] || 0;
  const highFindings = findingStats.bySeverity["high"] || 0;
  const mediumFindings = findingStats.bySeverity["medium"] || 0;
  const lowFindings = findingStats.bySeverity["low"] || 0;

  const securityPenalty = Math.min(100,
    criticalFindings * 20 + highFindings * 10 + mediumFindings * 5 + lowFindings * 2
  );
  const securityScore = Math.max(0, 100 - securityPenalty);

  // Compliance score (30% weight): Certs + residency
  // Each expiring cert = -15, each violation = -20
  const compliancePenalty = Math.min(100, expiringCerts * 15 + residencyViolations * 20);
  const complianceScore = Math.max(0, 100 - compliancePenalty);

  // Cost efficiency score (30% weight): Orphaned resources ratio
  // If >10% orphaned = bad, scale down to 0% = 100
  const orphanedRatio = orphanedCount / totalResources;
  const costScore = Math.max(0, Math.round(100 - (orphanedRatio * 1000))); // 10% orphaned = 0 score

  // Overall weighted score
  const overall = Math.round(
    securityScore * 0.4 + complianceScore * 0.3 + costScore * 0.3
  );

  return {
    overall,
    security: securityScore,
    compliance: complianceScore,
    costEfficiency: costScore,
  };
}

// Helper: Get health status from score
function getHealthStatus(score: number): 'excellent' | 'good' | 'fair' | 'needs_attention' {
  if (score >= 90) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'fair';
  return 'needs_attention';
}

// Helper: Calculate issues to resolve for next level
function calculateIssuesToResolve(
  currentScore: number,
  highFindings: number,
  criticalFindings: number
): number {
  // Estimate how many high-severity issues to fix to reach next level
  if (currentScore >= 90) return 0;
  if (currentScore >= 70) {
    // Need to reach 90 - each high finding is ~10 points
    return Math.min(highFindings + criticalFindings, Math.ceil((90 - currentScore) / 8));
  }
  if (currentScore >= 50) {
    return Math.min(highFindings + criticalFindings, Math.ceil((70 - currentScore) / 8));
  }
  return Math.min(highFindings + criticalFindings, Math.ceil((50 - currentScore) / 8));
}

// Helper: Aggregate cost savings from findings
function aggregateCostInsights(
  findings: Finding[]
): { totalPotentialSavings: number; byCategory: Array<{ type: string; label: string; count: number; savings: number }> } {
  const categoryMap: Record<string, { label: string; count: number; savings: number }> = {};

  const costFindingTypes: Record<string, string> = {
    orphaned_volume: "Orphaned Volumes",
    orphaned_eip: "Orphaned Elastic IPs",
    orphaned_snapshot: "Orphaned Snapshots",
    orphaned_eni: "Orphaned ENIs",
    idle_load_balancer: "Idle Load Balancers",
    idle_nat_gateway: "Idle NAT Gateways",
    unused_security_group: "Unused Security Groups",
    stopped_instance: "Stopped Instances",
    unused_resource: "Unused Resources",
    unused_log_group: "Unused Log Groups",
    // Cost optimization findings
    ebs_optimization: "EBS gp2 to gp3 Migration",
    old_gen_instance: "Old Generation Instances",
    oversized_lambda: "Oversized Lambda Functions",
    log_retention: "No Log Retention Policy",
    unused_kms_key: "Unused KMS Keys",
    rds_optimization: "RDS Optimization",
  };

  findings.forEach(finding => {
    if (costFindingTypes[finding.type]) {
      const savings = (finding.details?.estimated_monthly_cost as number) ||
                      (finding.details?.estimatedMonthlySavings as number) ||
                      (finding.details?.estimated_savings as number) ||
                      (finding.details?.monthlyCost as number) || 0;

      if (!categoryMap[finding.type]) {
        categoryMap[finding.type] = {
          label: costFindingTypes[finding.type],
          count: 0,
          savings: 0
        };
      }
      categoryMap[finding.type].count++;
      categoryMap[finding.type].savings += savings;
    }
  });

  const byCategory = Object.entries(categoryMap)
    .map(([type, data]) => ({ type, ...data }))
    .filter(c => c.count > 0)
    .sort((a, b) => b.savings - a.savings);

  const totalPotentialSavings = byCategory.reduce((sum, c) => sum + c.savings, 0);

  return { totalPotentialSavings, byCategory };
}

// Enhanced Dashboard Summary with all computed metrics
export async function getEnhancedDashboardSummary(filters?: {
  awsAccountId?: string;
  hiddenFindingTypes?: FindingType[];
}): Promise<EnhancedDashboardSummary> {
  try {
    // Fetch all required data
    // Use Promise.allSettled for findings to handle tier restrictions gracefully
    console.log("[getEnhancedDashboardSummary] Fetching data...");
    const [resourceStats, findingStats, resourceHealth, openFindingsSettled] = await Promise.all([
      getResourceStats(filters),
      getFindingStats(filters),
      // Resource health is calculated on the backend (accessible to all tiers)
      getResourceHealth(filters),
      // Wrap findings fetch to handle 403 errors for free tier users
      getFindings({ status: "open", limit: 100, awsAccountId: filters?.awsAccountId })
        .catch((error) => {
          // If findings list is blocked (403), return empty result
          // This allows dashboard to still load with stats-only data
          console.log("[getEnhancedDashboardSummary] Findings list not available (likely tier restriction):", error?.message);
          return { data: [], pagination: { total: 0, page: 1, limit: 100, totalPages: 0 } };
        }),
    ]);

    const openFindingsResult = openFindingsSettled;
    const hiddenTypes = new Set(filters?.hiddenFindingTypes || []);

    // Filter open findings to exclude hidden types
    const openFindings = (openFindingsResult?.data || []).filter(
      f => !hiddenTypes.has(f.type as FindingType)
    );

    console.log("[getEnhancedDashboardSummary] Data fetched:", {
      resourceStats: !!resourceStats,
      findingStats: !!findingStats,
      resourceHealth: !!resourceHealth,
      openFindingsCount: openFindings.length,
      hiddenTypesCount: hiddenTypes.size
    });

    // Safety checks
    if (!resourceStats || !findingStats || !resourceHealth) {
      console.error("[getEnhancedDashboardSummary] Missing data:", { resourceStats, findingStats, resourceHealth });
      throw new Error("Failed to fetch dashboard data");
    }

    // Filter byType to exclude hidden types
    const rawByType = findingStats.byType || {};
    const byType: Record<string, number> = {};
    for (const [type, count] of Object.entries(rawByType)) {
      if (!hiddenTypes.has(type as FindingType)) {
        byType[type] = count;
      }
    }

    // Recalculate bySeverity from filtered byType using the type->severity mapping
    const byTypeSeverity = findingStats.byTypeSeverity || {};
    const bySeverity: Record<string, number> = {};
    for (const [type, count] of Object.entries(byType)) {
      const severity = byTypeSeverity[type];
      if (severity) {
        bySeverity[severity] = (bySeverity[severity] || 0) + count;
      }
    }

    const orphanedCount =
      (byType["orphaned_volume"] || 0) +
      (byType["orphaned_eip"] || 0) +
      (byType["orphaned_snapshot"] || 0) +
      (byType["orphaned_eni"] || 0) +
      (byType["idle_load_balancer"] || 0) +
      (byType["idle_nat_gateway"] || 0) +
      (byType["unused_security_group"] || 0);

    const expiringCertificates = byType["ssl_expiry"] || 0;
    const residencyViolations = byType["data_residency_violation"] || 0;

    // Compute enhanced metrics using filtered bySeverity (accounts for hidden types)
    const filteredFindingStats = {
      ...findingStats,
      bySeverity,
    };
    const healthScores = calculateHealthScores(
      filteredFindingStats,
      resourceStats,
      orphanedCount,
      residencyViolations,
      expiringCertificates
    );

    const healthStatus = getHealthStatus(healthScores.overall);

    const criticalFindings = bySeverity["critical"] || 0;
    const highFindings = bySeverity["high"] || 0;
    const issuesToResolve = calculateIssuesToResolve(healthScores.overall, highFindings, criticalFindings);

    // Finding counts - calculate total from individual counts to ensure consistency
    const mediumFindings = bySeverity["medium"] || 0;
    const lowFindings = bySeverity["low"] || 0;
    const trivialFindings = bySeverity["trivial"] || 0;
    const findingCounts = {
      critical: criticalFindings,
      high: highFindings,
      medium: mediumFindings,
      low: lowFindings,
      trivial: trivialFindings,
      total: criticalFindings + highFindings + mediumFindings + lowFindings + trivialFindings,
    };

    // Cost insights from actual findings
    const costInsights = aggregateCostInsights(openFindings);

    // Certificate insights
    // Count SSL findings by urgency from details
    let urgentCerts = 0;
    let expiringSoonCerts = 0;
    let nearestExpiryDays: number | null = null;

    openFindings.filter(f => f.type === "ssl_expiry").forEach(f => {
      const daysUntil = (f.details?.days_until_expiry as number) ||
                        (f.details?.daysUntilExpiry as number) || 30;
      if (nearestExpiryDays === null || daysUntil < nearestExpiryDays) {
        nearestExpiryDays = daysUntil;
      }
      if (daysUntil <= 7) {
        urgentCerts++;
      } else if (daysUntil <= 30) {
        expiringSoonCerts++;
      }
    });

    const certificateInsights = {
      total: expiringCertificates,
      healthy: 0, // Would need total certs from separate query
      expiringSoon: expiringSoonCerts,
      urgent: urgentCerts,
      nearestExpiryDays,
    };

    // Resource health is fetched from backend (not calculated locally)
    // This ensures Free tier users get accurate resource health data

    // Compliance details
    // Security issues should count security-related finding types (matching the filter link in ComplianceStatusCard)
    const complianceDetails = {
      residencyViolations,
      missingTags: byType["missing_tag"] || 0,
      securityIssues: (byType["public_access"] || 0) + (byType["permissive_security_group"] || 0) + (byType["unencrypted_resource"] || 0),
    };

    return {
      // Legacy fields
      totalResources: resourceStats.totalCount,
      resourcesTrend: 0,
      orphanedResources: orphanedCount,
      orphanedSavings: costInsights.totalPotentialSavings,
      expiringCertificates,
      urgentCertificates: urgentCerts,
      residencyViolations,
      // Enhanced fields
      healthScores,
      healthStatus,
      issuesToResolve,
      findingCounts,
      costInsights,
      certificateInsights,
      resourceHealth,
      complianceDetails,
    };
  } catch (error) {
    handleApiError(error);
  }
}

// ============================================
// Profile API
// ============================================

export async function updateProfile(updates: { fullName?: string }): Promise<User> {
  try {
    const { data } = await api.patch<{ user: User }>("/auth/profile", updates);
    return data.user;
  } catch (error) {
    handleApiError(error);
  }
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  try {
    await api.post("/auth/change-password", { currentPassword, newPassword });
  } catch (error) {
    handleApiError(error);
  }
}

// ============================================
// Two-Factor Authentication API
// ============================================

export interface TwoFactorStatus {
  enabled: boolean;
  recoveryCodesRemaining: number;
}

export interface TwoFactorSetupInit {
  qrCodeUri: string;
  secret: string;
}

export interface TwoFactorSetupVerify {
  recoveryCodes: string[];
}

export async function get2FAStatus(): Promise<TwoFactorStatus> {
  try {
    const { data } = await api.get<TwoFactorStatus>("/auth/2fa/status");
    return data;
  } catch (error) {
    handleApiError(error);
  }
}

export async function init2FASetup(): Promise<TwoFactorSetupInit> {
  try {
    const { data } = await api.post<TwoFactorSetupInit>("/auth/2fa/setup/init");
    return data;
  } catch (error) {
    handleApiError(error);
  }
}

export async function verify2FASetup(code: string): Promise<TwoFactorSetupVerify> {
  try {
    const { data } = await api.post<TwoFactorSetupVerify>("/auth/2fa/setup/verify", { code });
    return data;
  } catch (error) {
    handleApiError(error);
  }
}

export async function disable2FA(password: string, code: string): Promise<void> {
  try {
    await api.post("/auth/2fa/disable", { password, code });
  } catch (error) {
    handleApiError(error);
  }
}

export async function verify2FAChallenge(challengeToken: string, code: string): Promise<LoginResponse> {
  try {
    const { data } = await api.post<LoginResponse>("/auth/2fa/verify", { challengeToken, code });
    return data;
  } catch (error) {
    handleApiError(error);
  }
}

export async function verify2FARecovery(challengeToken: string, recoveryCode: string): Promise<LoginResponse> {
  try {
    const { data } = await api.post<LoginResponse>("/auth/2fa/verify-recovery", { challengeToken, recoveryCode });
    return data;
  } catch (error) {
    handleApiError(error);
  }
}

export async function regenerate2FARecoveryCodes(password: string, code: string): Promise<{ recoveryCodes: string[] }> {
  try {
    const { data } = await api.post<{ recoveryCodes: string[] }>("/auth/2fa/recovery-codes/regenerate", { password, code });
    return data;
  } catch (error) {
    handleApiError(error);
  }
}

// ============================================
// Subscription API
// ============================================

export async function getSubscriptionStatus(orgId: string): Promise<SubscriptionStatus> {
  try {
    const { data } = await api.get<{ data: SubscriptionStatus }>(`/orgs/${orgId}/subscription`);
    return data.data;
  } catch (error) {
    handleApiError(error);
  }
}

export async function upgradeSubscription(
  orgId: string,
  targetTier: SubscriptionTier
): Promise<{ tier: SubscriptionTier }> {
  try {
    const { data } = await api.post<{ data: { tier: SubscriptionTier } }>(
      `/orgs/${orgId}/subscription/upgrade`,
      { targetTier }
    );
    return data.data;
  } catch (error) {
    handleApiError(error);
  }
}


// Stripe: Create checkout session for starting a trial subscription
export async function createCheckoutSession(
  _orgId: string,
  targetTier: SubscriptionTier,
  successUrl?: string,
  cancelUrl?: string
): Promise<CheckoutSession> {
  try {
    const { data } = await api.post<{ data: CheckoutSession }>(
      `/stripe/checkout`,
      { targetTier, successUrl, cancelUrl }
    );
    return data.data;
  } catch (error) {
    handleApiError(error);
  }
}

// Stripe: Create customer portal session for managing subscription
export async function createPortalSession(
  _orgId: string,
  returnUrl?: string
): Promise<PortalSession> {
  try {
    const { data } = await api.post<{ data: PortalSession }>(
      `/stripe/portal`,
      { returnUrl }
    );
    return data.data;
  } catch (error) {
    handleApiError(error);
  }
}
