import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { requireAuth } from '../middlewares/auth.js';
import { awsAccountService } from '../services/awsAccountService.js';
import { HTTP400Error } from '../lib/errors.js';
import type { Variables } from '../types/index.js';

const awsAccountsRoute = new Hono<{ Variables: Variables }>();

// All routes require authentication
awsAccountsRoute.use(requireAuth);

// Validation schemas
const createAccountSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  awsAccountId: z
    .string()
    .length(12, 'AWS account ID must be 12 digits')
    .regex(/^\d{12}$/, 'AWS account ID must be 12 digits'),
  roleArn: z
    .string()
    .min(1, 'Role ARN is required')
    .regex(/^arn:aws:iam::\d{12}:role\//, 'Invalid role ARN format'),
  externalId: z.string().max(255).optional(),
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

  await awsAccountService.deleteAccount(orgId, accountId);
  return c.json({ message: 'AWS account deleted successfully' });
});

// POST /aws/accounts/:id/test - Test AWS account connection
awsAccountsRoute.post('/:id/test', async (c) => {
  const orgId = c.get('orgId');
  const accountId = c.req.param('id');

  if (!orgId) {
    throw new HTTP400Error('No organization selected');
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

  const scans = await awsAccountService.getScanHistory(orgId, accountId);
  return c.json({ data: scans });
});

// GET /aws/scans/:scanId - Get specific scan details
awsAccountsRoute.get('/scans/:scanId', async (c) => {
  const orgId = c.get('orgId');
  const scanId = c.req.param('scanId');

  if (!orgId) {
    throw new HTTP400Error('No organization selected');
  }

  const scan = await awsAccountService.getScan(orgId, scanId);
  return c.json({ data: scan });
});

export default awsAccountsRoute;
