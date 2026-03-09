import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { requireAuth } from '../middlewares/auth.js';
import { requireNoProcessingRestriction } from '../middlewares/processingRestriction.js';
import { awsAccountService } from '../services/awsAccountService.js';
import { HTTP400Error } from '../lib/errors.js';
import type { Variables } from '../types/index.js';

const awsAccountsRoute = new Hono<{ Variables: Variables }>();

// All routes require authentication
awsAccountsRoute.use(requireAuth);
// Block write operations when GDPR processing restriction is active (Article 18)
awsAccountsRoute.use('*', async (c, next) => {
  if (c.req.method !== 'GET') {
    return requireNoProcessingRestriction(c, next);
  }
  await next();
});

// Scanner type enum for validation
const scannerTypeEnum = z.enum([
  'ec2', 'rds', 's3', 'alb', 'acm', 'lambda',
  'cloudwatch', 'iam', 'security_groups', 'secrets_manager', 'kms'
]);

// Validation schemas
const createAccountSchema = z.object({
  name: z.string().min(1, 'Name is required').max(32, 'Name must be at most 32 characters'),
  awsAccountId: z
    .string()
    .length(12, 'AWS account ID must be 12 digits')
    .regex(/^\d{12}$/, 'AWS account ID must be 12 digits'),
  roleArn: z
    .string()
    .min(1, 'Role ARN is required')
    .regex(/^arn:aws:iam::\d{12}:role\//, 'Invalid role ARN format'),
  externalId: z.string().max(255).optional(),
  enabledScanners: z.array(scannerTypeEnum).optional(), // Default to all if not provided
});

// Schema for updating scanner configuration
const updateScannersSchema = z.object({
  enabledScanners: z.array(scannerTypeEnum).min(1, 'At least one scanner must be enabled'),
});

// GET /aws/accounts - List AWS accounts
awsAccountsRoute.get('/', async (c) => {
  const orgId = c.get('orgId');

  if (!orgId) {
    throw new HTTP400Error('No organization selected');
  }

  const accounts = await awsAccountService.getAccounts(orgId);
  return c.json({ data: accounts });
});

// POST /aws/accounts - Create AWS account
awsAccountsRoute.post('/', zValidator('json', createAccountSchema), async (c) => {
  const orgId = c.get('orgId');

  if (!orgId) {
    throw new HTTP400Error('No organization selected');
  }

  const data = c.req.valid('json');
  const account = await awsAccountService.createAccount(orgId, data);
  return c.json({ data: account }, 201);
});

// GET /aws/accounts/:id - Get AWS account details
awsAccountsRoute.get('/:id', async (c) => {
  const orgId = c.get('orgId');
  const accountId = c.req.param('id');

  if (!orgId) {
    throw new HTTP400Error('No organization selected');
  }

  if (!accountId) {
    throw new HTTP400Error('Account ID is required');
  }

  const account = await awsAccountService.getAccount(orgId, accountId);
  return c.json({ data: account });
});

// DELETE /aws/accounts/:id - Delete AWS account
awsAccountsRoute.delete('/:id', async (c) => {
  const orgId = c.get('orgId');
  const accountId = c.req.param('id');

  if (!orgId) {
    throw new HTTP400Error('No organization selected');
  }

  if (!accountId) {
    throw new HTTP400Error('Account ID is required');
  }

  await awsAccountService.deleteAccount(orgId, accountId);
  return c.json({ message: 'AWS account deleted successfully' });
});

// PATCH /aws/accounts/:id/scanners - Update enabled scanners
awsAccountsRoute.patch(
  '/:id/scanners',
  zValidator('json', updateScannersSchema),
  async (c) => {
    const orgId = c.get('orgId');
    const accountId = c.req.param('id');

    if (!orgId) {
      throw new HTTP400Error('No organization selected');
    }

    if (!accountId) {
      throw new HTTP400Error('Account ID is required');
    }

    const { enabledScanners } = c.req.valid('json');
    const account = await awsAccountService.updateEnabledScanners(orgId, accountId, enabledScanners);
    return c.json({ data: account });
  }
);

// POST /aws/accounts/:id/test - Test AWS account connection
awsAccountsRoute.post('/:id/test', async (c) => {
  const orgId = c.get('orgId');
  const accountId = c.req.param('id');

  if (!orgId) {
    throw new HTTP400Error('No organization selected');
  }

  if (!accountId) {
    throw new HTTP400Error('Account ID is required');
  }

  const result = await awsAccountService.testConnection(orgId, accountId);
  return c.json({ data: result });
});

// POST /aws/accounts/:id/scan - Enqueue scan for AWS account
awsAccountsRoute.post('/:id/scan', async (c) => {
  const orgId = c.get('orgId');
  const accountId = c.req.param('id');

  if (!orgId) {
    throw new HTTP400Error('No organization selected');
  }

  if (!accountId) {
    throw new HTTP400Error('Account ID is required');
  }

  const scan = await awsAccountService.enqueueScan(orgId, accountId);
  return c.json({ data: scan }, 202);
});

// GET /aws/accounts/:id/scans - Get scan history for AWS account
awsAccountsRoute.get('/:id/scans', async (c) => {
  const orgId = c.get('orgId');
  const accountId = c.req.param('id');

  if (!orgId) {
    throw new HTTP400Error('No organization selected');
  }

  if (!accountId) {
    throw new HTTP400Error('Account ID is required');
  }

  const scans = await awsAccountService.getScanHistory(orgId, accountId);
  return c.json({ data: scans });
});

// Validation schema for analysis
const analyzeSchema = z.object({
  type: z.enum(['orphans', 'ssl', 'residency', 'all']).optional().default('all'),
  allowedRegions: z.array(z.string()).optional(),
});

// POST /aws/accounts/:id/analyze - Trigger analysis for AWS account
awsAccountsRoute.post(
  '/:id/analyze',
  zValidator('json', analyzeSchema),
  async (c) => {
    const orgId = c.get('orgId');
    const accountId = c.req.param('id');

    if (!orgId) {
      throw new HTTP400Error('No organization selected');
    }

    if (!accountId) {
      throw new HTTP400Error('Account ID is required');
    }

    const { type, allowedRegions } = c.req.valid('json');

    if (type === 'all') {
      await awsAccountService.enqueueAllAnalyses(orgId, accountId);
      return c.json({ message: 'All analyses enqueued' }, 202);
    }

    const analysisTypeMap = {
      orphans: 'analyze_orphans',
      ssl: 'analyze_ssl',
      residency: 'analyze_residency',
    } as const;

    await awsAccountService.enqueueAnalysis(
      orgId,
      accountId,
      analysisTypeMap[type],
      allowedRegions
    );

    return c.json({ message: `${type} analysis enqueued` }, 202);
  }
);

export default awsAccountsRoute;
