import { eq, and, desc } from 'drizzle-orm';
import { STSClient, AssumeRoleCommand, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import { db } from '../lib/db.js';
import { redis } from '../lib/redis.js';
import { HTTP400Error, HTTP404Error } from '../lib/errors.js';
import { awsAccounts, scans, jobs } from '../db/schema.js';
import type { AwsAccount, Scan, NewAwsAccount } from '../db/schema.js';
import { config } from '../lib/config.js';

interface CreateAccountData {
  name: string;
  awsAccountId: string;
  roleArn: string;
  externalId?: string;
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
      } satisfies NewAwsAccount)
      .returning();

    return account;
  },

  async deleteAccount(orgId: string, accountId: string): Promise<void> {
    const result = await db
      .delete(awsAccounts)
      .where(
        and(
          eq(awsAccounts.id, accountId),
          eq(awsAccounts.orgId, orgId)
        )
      )
      .returning({ id: awsAccounts.id });

    if (result.length === 0) {
      throw new HTTP404Error('AWS account not found');
    }
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
        awsAccountId: identityResponse.Account,
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

    // Create scan record
    const [scan] = await db
      .insert(scans)
      .values({
        orgId,
        awsAccountId: accountId,
        status: 'pending',
      })
      .returning();

    // Create job record
    const [job] = await db
      .insert(jobs)
      .values({
        type: 'scan_account',
        payload: {
          scanId: scan.id,
          orgId,
          awsAccountId: accountId,
          roleArn: account.roleArn,
          externalId: account.externalId,
        },
        status: 'queued',
      })
      .returning();

    // Push to Redis queue for workers to pick up
    await redis.lpush('jobs:scan_account', JSON.stringify({
      jobId: job.id,
      scanId: scan.id,
      orgId,
      awsAccountId: accountId,
      roleArn: account.roleArn,
      externalId: account.externalId,
    }));

    return scan;
  },

  async getScanHistory(orgId: string, accountId: string): Promise<Scan[]> {
    // Verify account belongs to org
    await this.getAccount(orgId, accountId);

    return db
      .select()
      .from(scans)
      .where(
        and(
          eq(scans.orgId, orgId),
          eq(scans.awsAccountId, accountId)
        )
      )
      .orderBy(desc(scans.createdAt))
      .limit(50);
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
};
