import type { Context, Next } from 'hono';
import { apiKeyService } from '../services/apiKeyService.js';
import { getOrgTier } from '../services/orgService.js';
import { HTTP401Error, HTTP403Error } from '../lib/errors.js';
import { TIER_LIMITS, type Variables } from '../types/index.js';

/**
 * Authentication middleware for the public API (API key-based).
 *
 * API key must be provided in the X-API-Key header.
 * Format: sk_live_<64 hex chars> (72 chars total)
 *
 * Sets orgId in context. userId is set to empty string (no user context).
 */
export const requireApiKey = async (
  c: Context<{ Variables: Variables }>,
  next: Next
) => {
  const apiKey = c.req.header('X-API-Key');

  if (!apiKey) {
    throw new HTTP401Error('Missing API key. Provide X-API-Key header.');
  }

  // Validate format before hitting the database
  if (!apiKey.startsWith('sk_live_') || apiKey.length !== 72) {
    throw new HTTP401Error('Invalid API key format');
  }

  const result = await apiKeyService.validateApiKey(apiKey);
  if (!result) {
    throw new HTTP401Error('Invalid API key');
  }

  // Verify org is still on Team tier
  const tier = await getOrgTier(result.orgId);
  if (!TIER_LIMITS[tier].canUseApiKeys) {
    throw new HTTP403Error('API key access requires Team plan');
  }

  // Set context — userId is null for API key auth (no user session)
  c.set('orgId', result.orgId);
  c.set('userId', null as unknown as string);

  // Touch last used (fire-and-forget)
  apiKeyService.touchLastUsed(result.keyId);

  await next();
};
