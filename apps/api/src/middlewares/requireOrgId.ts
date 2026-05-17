import type { Context, Next } from 'hono';
import { HTTP400Error } from '../lib/errors.js';
import type { Variables } from '../types/index.js';

/**
 * Middleware that requires a valid orgId in the context.
 * Use on routes that operate on organization-scoped resources
 * to avoid repeating the same check in every handler.
 */
export const requireOrgId = async (
  c: Context<{ Variables: Variables }>,
  next: Next
) => {
  const orgId = c.get('orgId');

  if (!orgId) {
    throw new HTTP400Error('No organization selected');
  }

  await next();
};
