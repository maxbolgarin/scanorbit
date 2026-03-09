import { eq, and, desc, inArray, not, gte } from 'drizzle-orm';
import { STSClient, AssumeRoleCommand, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import { db } from '../lib/db.js';
import { redis } from '../lib/redis.js';
import { logger } from '../lib/logger.js';
import { HTTP400Error, HTTP403Error, HTTP404Error, HTTP429Error } from '../lib/errors.js';
import { awsAccounts, scans, jobs, orgSettings } from '../db/schema.js';
import type { AwsAccount, Scan, NewAwsAccount } from '../db/schema.js';
import { config } from '../lib/config.js';
import { scansTriggered, jobsEnqueued, awsAccountsConnected } from '../lib/metrics.js';
import { getOrgTier } from './orgService.js';
import { encryptExternalIdOptional, decryptExternalIdOptional } from '../lib/crypto.js';
import {
  ScanStatus,
  ACTIVE_SCAN_STATUSES,
  TERMINAL_SCAN_STATUSES,
  ALL_SCANNER_TYPES,
  ANALYZER_SCANNER_DEPS,
  TIER_LIMITS,
  type ScannerType,
} from '../types/index.js';

/**
 * Decrypt the external ID in an AWS account object
 * Returns a new object with the decrypted external ID (for API responses)
 */
function decryptAccountExternalId(account: AwsAccount): AwsAccount {
  return {
    ...account,
    externalId: decryptExternalIdOptional(account.externalId),
  };
}

/**
 * Decrypt external IDs in an array of AWS account objects
 */
function decryptAccountsExternalIds(accounts: AwsAccount[]): AwsAccount[] {
  return accounts.map(decryptAccountExternalId);
}

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
  message?: string;
  regions?: string[];
}

export const awsAccountService = {
  async getAccounts(orgId: string): Promise<AwsAccount[]> {
    const accounts = await db
      .select()
      .from(awsAccounts)
      .where(eq(awsAccounts.orgId, orgId))
      .orderBy(desc(awsAccounts.createdAt));

    // Decrypt external IDs for API response
    return decryptAccountsExternalIds(accounts);
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

    // Decrypt external ID for API response
    return decryptAccountExternalId(account);
  },

  async createAccount(
    orgId: string,
    data: CreateAccountData
  ): Promise<AwsAccount> {
    // Validate formats before transaction
    if (!/^\d{12}$/.test(data.awsAccountId)) {
      throw new HTTP400Error('Invalid AWS account ID format (must be 12 digits)');
    }
    if (!data.roleArn.startsWith('arn:aws:iam::')) {
      throw new HTTP400Error('Invalid role ARN format');
    }

    const encryptedExternalId = encryptExternalIdOptional(data.externalId);

    // Use transaction to prevent duplicate check race condition
    const account = await db.transaction(async (tx) => {
      const existingById = await tx
        .select({ id: awsAccounts.id })
        .from(awsAccounts)
        .where(
          and(
            eq(awsAccounts.orgId, orgId),
            eq(awsAccounts.awsAccountId, data.awsAccountId)
          )
        )
        .limit(1);

      if (existingById.length > 0) {
        throw new HTTP400Error('AWS account already connected to this organization');
      }

      const existingByName = await tx
        .select({ id: awsAccounts.id })
        .from(awsAccounts)
        .where(
          and(
            eq(awsAccounts.orgId, orgId),
            eq(awsAccounts.name, data.name)
          )
        )
        .limit(1);

      if (existingByName.length > 0) {
        throw new HTTP400Error('An account with this name already exists');
      }

      const [created] = await tx
        .insert(awsAccounts)
        .values({
          orgId,
          name: data.name,
          awsAccountId: data.awsAccountId,
          roleArn: data.roleArn,
          externalId: encryptedExternalId,
          status: 'pending',
          enabledScanners: data.enabledScanners ?? ALL_SCANNER_TYPES,
        } satisfies NewAwsAccount)
        .returning();

      return created;
    });

    awsAccountsConnected.inc();
    return decryptAccountExternalId(account);
  },

  async deleteAccount(orgId: string, accountId: string): Promise<void> {
    // Use transaction for atomic deletion of account and related scan updates
    await db.transaction(async (tx) => {
      // Verify account exists before deletion
      const [account] = await tx
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
      await tx
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
      await tx
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
      await tx
        .delete(awsAccounts)
        .where(eq(awsAccounts.id, accountId));
    });

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

    // Decrypt external ID for API response
    return decryptAccountExternalId(account);
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

      // Verify the assumed role points to the correct AWS account
      if (identityResponse.Account && identityResponse.Account !== account.awsAccountId) {
        throw new HTTP400Error(
          `AWS account ID mismatch: expected ${account.awsAccountId} but got ${identityResponse.Account}. Verify the role ARN points to the correct account.`
        );
      }

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
        message: 'Connection successful! ScanOrbit can access your AWS account.',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      let userFriendlyMessage = errorMessage;

      // Provide user-friendly error messages for common IAM issues
      if (errorMessage.includes('AccessDenied') || errorMessage.includes('is not authorized to perform: sts:AssumeRole')) {
        userFriendlyMessage = 
          'Unable to assume the IAM role. Please verify:\n' +
          '1. The role\'s trust policy allows ScanOrbit\'s AWS account to assume it\n' +
          '2. The Principal in the trust policy is set to: arn:aws:iam::ACCOUNT_ID:root (where ACCOUNT_ID is ScanOrbit\'s account)\n' +
          '3. The External ID in the trust policy matches the one shown in the setup guide\n' +
          '4. The role exists and the ARN is correct';
      } else if (errorMessage.includes('InvalidUserID.NotFound') || errorMessage.includes('does not exist')) {
        userFriendlyMessage = 'The IAM role does not exist. Please verify the role ARN is correct and the role has been created.';
      } else if (errorMessage.includes('InvalidParameter') && errorMessage.includes('ExternalId')) {
        userFriendlyMessage = 'The External ID does not match. Please verify the External ID in the role\'s trust policy matches the one shown in the setup guide.';
      } else if (errorMessage.includes('MalformedPolicyDocument')) {
        userFriendlyMessage = 'The role\'s trust policy is malformed. Please check the trust policy configuration in the IAM console.';
      }

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
        message: userFriendlyMessage,
      };
    }
  },

  async enqueueScan(orgId: string, accountId: string): Promise<Scan> {
    // Use transaction with pessimistic locking to prevent race conditions
    // This ensures only one scan can be created at a time for an account
    const result = await db.transaction(async (tx) => {
      // Lock the account row with FOR UPDATE to prevent concurrent scan creation
      // This blocks other transactions trying to scan the same account
      const lockedAccounts = await tx
        .select()
        .from(awsAccounts)
        .where(
          and(
            eq(awsAccounts.id, accountId),
            eq(awsAccounts.orgId, orgId)
          )
        )
        .for('update')
        .limit(1);

      const account = lockedAccounts[0];
      if (!account) {
        throw new HTTP404Error('AWS account not found');
      }

      // Get org tier INSIDE transaction so the check is consistent with the lock
      const tier = await getOrgTier(orgId);

      // Tier-based scan checks (inside transaction to ensure consistency)
      if (tier === 'free') {
        // Free tier: Only one successful scan ever allowed (unlimited retries until success)
        const [successfulScan] = await tx
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

        const [recentScan] = await tx
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
      // Team tier: No additional tier checks (existing concurrency check remains)

      // Check if there's already an active scan for this account (with lock held)
      const [activeScan] = await tx
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

      return { scan, job, account };
    });

    const { scan, job, account } = result;

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
      logger.error('[enqueueScan] Redis error, marking scan as failed', redisError as Error);
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
      logger.error(`[enqueueAnalysis] Redis error for ${analysisType}, marking job as failed`, redisError as Error);
      await db.update(jobs).set({ status: 'error' }).where(eq(jobs.id, job.id));
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
