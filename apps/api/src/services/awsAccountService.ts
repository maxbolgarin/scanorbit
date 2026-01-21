import { eq, and, desc, inArray, not, gte } from 'drizzle-orm';
import { STSClient, AssumeRoleCommand, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import { db } from '../lib/db.js';
import { redis } from '../lib/redis.js';
import { HTTP400Error, HTTP403Error, HTTP404Error, HTTP429Error } from '../lib/errors.js';
import { awsAccounts, scans, jobs, orgSettings } from '../db/schema.js';
import type { AwsAccount, Scan, NewAwsAccount } from '../db/schema.js';
import { config } from '../lib/config.js';
import { scansTriggered, jobsEnqueued, awsAccountsConnected } from '../lib/metrics.js';
import { getOrgTier } from './orgService.js';
import {
  ScanStatus,
  ACTIVE_SCAN_STATUSES,
  TERMINAL_SCAN_STATUSES,
  ALL_SCANNER_TYPES,
  ANALYZER_SCANNER_DEPS,
  TIER_LIMITS,
  type ScannerType,
} from '../types/index.js';

interface CreateAccountData {
  name: string;
  awsAccountId: string;
  roleArn: string;
  externalId?: string;
  enabledScanners?: ScannerType[];
}

interface TestConnectionResult {
  success: boolean;
  awsAccountId?: string;
  error?: string;
}

export const awsAccountService = {
  async getAccounts(orgId: string): Promise<AwsAccount[]> {
    return db
      .select()
      .from(awsAccounts)
      .where(eq(awsAccounts.orgId, orgId))
      .orderBy(desc(awsAccounts.createdAt));
  },

  async getAccount(orgId: string, accountId: string): Promise<AwsAccount> {
    const [account] = await db
      .select()
      .from(awsAccounts)
      .where(
        and(
          eq(awsAccounts.id, accountId),
          eq(awsAccounts.orgId, orgId)
        )
      )
      .limit(1);

    if (!account) {
      throw new HTTP404Error('AWS account not found');
    }

    return account;
  },

  async createAccount(
    orgId: string,
    data: CreateAccountData
  ): Promise<AwsAccount> {
    // Check if account already exists for this org
    const existing = await db
      .select({ id: awsAccounts.id })
      .from(awsAccounts)
      .where(
        and(
          eq(awsAccounts.orgId, orgId),
          eq(awsAccounts.awsAccountId, data.awsAccountId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      throw new HTTP400Error('AWS account already connected to this organization');
    }

    // Validate AWS account ID format
    if (!/^\d{12}$/.test(data.awsAccountId)) {
      throw new HTTP400Error('Invalid AWS account ID format (must be 12 digits)');
    }

    // Validate role ARN format
    if (!data.roleArn.startsWith('arn:aws:iam::')) {
      throw new HTTP400Error('Invalid role ARN format');
    }

    const [account] = await db
      .insert(awsAccounts)
      .values({
        orgId,
        name: data.name,
        awsAccountId: data.awsAccountId,
        roleArn: data.roleArn,
        externalId: data.externalId,
        status: 'pending',
        enabledScanners: data.enabledScanners ?? ALL_SCANNER_TYPES,
      } satisfies NewAwsAccount)
      .returning();

    // Track AWS account connection
    awsAccountsConnected.inc();

    return account;
  },

  async deleteAccount(orgId: string, accountId: string): Promise<void> {
    // Verify account exists before deletion
    const [account] = await db
      .select({ id: awsAccounts.id })
      .from(awsAccounts)
      .where(
        and(
          eq(awsAccounts.id, accountId),
          eq(awsAccounts.orgId, orgId)
        )
      )
      .limit(1);

    if (!account) {
      throw new HTTP404Error('AWS account not found');
    }

    // 1. Cancel active scans (queued, processing, running, analyzing)
    await db
      .update(scans)
      .set({
        status: ScanStatus.CANCELED,
        completedAt: new Date(),
      })
      .where(
        and(
          eq(scans.awsAccountId, accountId),
          inArray(scans.status, ACTIVE_SCAN_STATUSES)
        )
      );

    // 2. Mark terminal scans (complete, partial, error) as having no key
    await db
      .update(scans)
      .set({ hasKey: false })
      .where(
        and(
          eq(scans.awsAccountId, accountId),
          inArray(scans.status, TERMINAL_SCAN_STATUSES),
          not(eq(scans.status, ScanStatus.CANCELED)) // Don't update canceled ones again
        )
      );

    // 3. Delete the account (scans FK will be set to NULL due to SET NULL constraint)
    await db
      .delete(awsAccounts)
      .where(eq(awsAccounts.id, accountId));

    // Track AWS account disconnection
    awsAccountsConnected.dec();
  },

  async updateEnabledScanners(
    orgId: string,
    accountId: string,
    enabledScanners: ScannerType[]
  ): Promise<AwsAccount> {
    // Verify account exists and belongs to org
    await this.getAccount(orgId, accountId);

    const [account] = await db
      .update(awsAccounts)
      .set({
        enabledScanners,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(awsAccounts.id, accountId),
          eq(awsAccounts.orgId, orgId)
        )
      )
      .returning();

    if (!account) {
      throw new HTTP404Error('AWS account not found');
    }

    return account;
  },

  async testConnection(
    orgId: string,
    accountId: string
  ): Promise<TestConnectionResult> {
    const account = await this.getAccount(orgId, accountId);

    const stsClient = new STSClient({ region: config.awsRegion });

    try {
      // Try to assume the role
      const assumeRoleCommand = new AssumeRoleCommand({
        RoleArn: account.roleArn,
        RoleSessionName: 'ScanOrbitConnectionTest',
        ExternalId: account.externalId ?? undefined,
        DurationSeconds: 900, // 15 minutes minimum
      });

      const assumeRoleResponse = await stsClient.send(assumeRoleCommand);

      if (!assumeRoleResponse.Credentials) {
        throw new Error('No credentials returned from AssumeRole');
      }

      // Create a new STS client with the assumed role credentials
      const assumedClient = new STSClient({
        region: config.awsRegion,
        credentials: {
          accessKeyId: assumeRoleResponse.Credentials.AccessKeyId!,
          secretAccessKey: assumeRoleResponse.Credentials.SecretAccessKey!,
          sessionToken: assumeRoleResponse.Credentials.SessionToken!,
        },
      });

      // Verify the assumed identity
      const identityCommand = new GetCallerIdentityCommand({});
      const identityResponse = await assumedClient.send(identityCommand);

      // Update account status to OK
      await db
        .update(awsAccounts)
        .set({
          status: 'ok',
          lastError: null,
          updatedAt: new Date(),
        })
        .where(eq(awsAccounts.id, accountId));

      return {
        success: true,
        awsAccountId: identityResponse.Account ?? 'unknown',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Update account status to error
      await db
        .update(awsAccounts)
        .set({
          status: 'error',
          lastError: errorMessage,
          updatedAt: new Date(),
        })
        .where(eq(awsAccounts.id, accountId));

      return {
        success: false,
        error: errorMessage,
      };
    }
  },

  async enqueueScan(orgId: string, accountId: string): Promise<Scan> {
    // Verify account exists and belongs to org
    const account = await this.getAccount(orgId, accountId);

    // Get org tier (safely handles missing column)
    const tier = await getOrgTier(orgId);

    // Tier-based scan checks
    if (tier === 'free') {
      // Free tier: Only one successful scan ever allowed (unlimited retries until success)
      const [successfulScan] = await db
        .select({ id: scans.id })
        .from(scans)
        .where(
          and(
            eq(scans.orgId, orgId),
            eq(scans.status, ScanStatus.COMPLETE)
          )
        )
        .limit(1);

      if (successfulScan) {
        throw new HTTP403Error('Free tier allows only one successful scan. Upgrade to Pro for more.');
      }
    } else if (tier === 'pro') {
      // Pro tier: 1 hour cooldown after successful scan
      const cooldownMinutes = TIER_LIMITS.pro.scanCooldownMinutes!;
      const cooldownTime = new Date(Date.now() - cooldownMinutes * 60 * 1000);

      const [recentScan] = await db
        .select({ id: scans.id, completedAt: scans.completedAt })
        .from(scans)
        .where(
          and(
            eq(scans.orgId, orgId),
            eq(scans.status, ScanStatus.COMPLETE),
            gte(scans.completedAt, cooldownTime)
          )
        )
        .orderBy(desc(scans.completedAt))
        .limit(1);

      if (recentScan && recentScan.completedAt) {
        const cooldownEndsAt = new Date(recentScan.completedAt.getTime() + cooldownMinutes * 60 * 1000);
        const waitMinutes = Math.ceil((cooldownEndsAt.getTime() - Date.now()) / 60000);
        throw new HTTP429Error(`Please wait ${waitMinutes} minutes before scanning again. Upgrade to Team for unlimited scans.`);
      }
    }
    // Team tier: No additional checks (existing concurrency check remains)

    // Check if there's already an active scan for this account
    const [activeScan] = await db
      .select({ id: scans.id, status: scans.status })
      .from(scans)
      .where(
        and(
          eq(scans.awsAccountId, accountId),
          inArray(scans.status, ACTIVE_SCAN_STATUSES)
        )
      )
      .limit(1);

    if (activeScan) {
      throw new HTTP400Error(`Scan already in progress (status: ${activeScan.status}). Please wait for it to complete.`);
    }

    // Use transaction to ensure scan and job are created together
    const result = await db.transaction(async (tx) => {
      // Create scan record with 'queued' status
      const [scan] = await tx
        .insert(scans)
        .values({
          orgId,
          awsAccountId: accountId,
          status: ScanStatus.QUEUED,
          hasKey: true,
        })
        .returning();

      // Create job record linked to the scan
      const [job] = await tx
        .insert(jobs)
        .values({
          scanId: scan.id,
          type: 'scan_account',
          payload: {
            account_id: accountId,
            org_id: orgId,
          },
          status: 'queued',
        })
        .returning();

      return { scan, job };
    });

    const { scan, job } = result;

    // Push to Redis queue for workers to pick up
    // Go workers expect snake_case: job_id, scan_id, account_id, org_id, enabled_scanners
    try {
      await redis.rpush('jobs:scan_account', JSON.stringify({
        job_id: job.id,
        scan_id: scan.id,
        account_id: accountId,
        org_id: orgId,
        enabled_scanners: account.enabledScanners,
      }));
    } catch (redisError) {
      // Redis failed - mark scan and job as failed to prevent inconsistency
      console.error('[enqueueScan] Redis error, marking scan as failed:', redisError);
      await Promise.all([
        db.update(scans).set({ status: ScanStatus.ERROR }).where(eq(scans.id, scan.id)),
        db.update(jobs).set({ status: 'error' }).where(eq(jobs.id, job.id)),
      ]);
      throw new HTTP400Error('Failed to queue scan job. Please try again.');
    }

    // Track scan triggered and job enqueued
    scansTriggered.inc({ org_id: orgId });
    jobsEnqueued.inc({ job_type: 'scan_account' });

    return scan;
  },

  async enqueueAnalysis(
    orgId: string,
    accountId: string,
    analysisType: 'analyze_orphans' | 'analyze_ssl' | 'analyze_residency' | 'analyze_security' | 'analyze_cost' | 'analyze_tagging' | 'analyze_iam',
    allowedRegions?: string[]
  ): Promise<void> {
    // Verify account exists and belongs to org
    await this.getAccount(orgId, accountId);

    // Build the job payload
    const payload: Record<string, unknown> = {
      account_id: accountId,
      org_id: orgId,
    };

    // Add residency policy for residency analysis
    if (analysisType === 'analyze_residency' && allowedRegions) {
      payload.policy = { allowed_regions: allowedRegions };
    }

    // Add required tags from org settings for tagging analysis
    if (analysisType === 'analyze_tagging') {
      const [settings] = await db
        .select({ requiredTags: orgSettings.requiredTags })
        .from(orgSettings)
        .where(eq(orgSettings.orgId, orgId))
        .limit(1);

      const requiredTags = settings?.requiredTags as string[] | undefined;
      if (requiredTags && requiredTags.length > 0) {
        payload.required_tags = requiredTags;
      }
    }

    // Create job record in database for tracking
    const [job] = await db.insert(jobs).values({
      type: analysisType,
      payload,
      status: 'queued',
    }).returning();

    // Push to Redis queue for workers to pick up
    // Include job_id so workers can update status
    try {
      await redis.rpush(`jobs:${analysisType}`, JSON.stringify({
        ...payload,
        job_id: job.id,
      }));
    } catch (redisError) {
      // Redis failed - mark job as failed
      console.error(`[enqueueAnalysis] Redis error for ${analysisType}, marking job as failed:`, redisError);
      await db.update(jobs).set({ status: 'failed' }).where(eq(jobs.id, job.id));
      throw new HTTP400Error(`Failed to queue ${analysisType} job. Please try again.`);
    }
    // Track job enqueued
    jobsEnqueued.inc({ job_type: analysisType });
  },

  async enqueueAllAnalyses(orgId: string, accountId: string): Promise<void> {
    // Get account to check enabled scanners
    const account = await this.getAccount(orgId, accountId);
    const enabledScanners = account.enabledScanners as ScannerType[];

    // Filter analyzers based on enabled scanners
    // An analyzer runs if at least one of its dependent scanners is enabled
    const allAnalyzers = [
      'analyze_orphans',
      'analyze_ssl',
      'analyze_residency',
      'analyze_security',
      'analyze_cost',
      'analyze_tagging',
      'analyze_iam',
    ] as const;

    const analyzersToRun = allAnalyzers.filter((analyzer) => {
      const deps = ANALYZER_SCANNER_DEPS[analyzer];
      return deps?.some((dep) => enabledScanners.includes(dep));
    });

    // Enqueue only relevant analyzers
    await Promise.all(
      analyzersToRun.map((analyzer) =>
        this.enqueueAnalysis(orgId, accountId, analyzer)
      )
    );
  },

  async getScan(orgId: string, scanId: string): Promise<Scan> {
    const [scan] = await db
      .select()
      .from(scans)
      .where(
        and(
          eq(scans.id, scanId),
          eq(scans.orgId, orgId)
        )
      )
      .limit(1);

    if (!scan) {
      throw new HTTP404Error('Scan not found');
    }

    return scan;
  },

  async getActiveScans(orgId: string): Promise<Scan[]> {
    return db
      .select()
      .from(scans)
      .where(
        and(
          eq(scans.orgId, orgId),
          inArray(scans.status, ACTIVE_SCAN_STATUSES)
        )
      )
      .orderBy(desc(scans.createdAt));
  },

  async getRecentScans(
    orgId: string,
    limit: number = 10,
    includeArchived: boolean = false
  ): Promise<Scan[]> {
    // Build conditions - always filter by orgId
    const conditions = [eq(scans.orgId, orgId)];

    // If not including archived, filter out scans without a key and canceled scans
    if (!includeArchived) {
      conditions.push(eq(scans.hasKey, true));
      conditions.push(not(eq(scans.status, ScanStatus.CANCELED)));
    }

    return db
      .select()
      .from(scans)
      .where(and(...conditions))
      .orderBy(desc(scans.createdAt))
      .limit(limit);
  },

  async getScanHistory(
    orgId: string,
    accountId: string,
    includeArchived: boolean = false
  ): Promise<Scan[]> {
    // Verify account belongs to org
    await this.getAccount(orgId, accountId);

    // Build conditions
    const conditions = [
      eq(scans.orgId, orgId),
      eq(scans.awsAccountId, accountId),
    ];

    // If not including archived, filter out canceled scans
    if (!includeArchived) {
      conditions.push(not(eq(scans.status, ScanStatus.CANCELED)));
    }

    return db
      .select()
      .from(scans)
      .where(and(...conditions))
      .orderBy(desc(scans.createdAt))
      .limit(50);
  },
};
