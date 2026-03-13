import crypto from 'node:crypto';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { apiKeys, users } from '../db/schema.js';
import { verifyOrgAdmin, getOrgTier } from './orgService.js';
import { logger } from '../lib/logger.js';
import { HTTP400Error, HTTP403Error, HTTP404Error } from '../lib/errors.js';
import { TIER_LIMITS } from '../types/index.js';

const MAX_API_KEYS_PER_ORG = 5;

export const apiKeyService = {
  /**
   * Create an API key — admin-only, Team-only
   * Returns the raw key (shown once) along with the key metadata.
   */
  async createApiKey(
    orgId: string,
    adminUserId: string,
    name: string,
    description?: string
  ) {
    await verifyOrgAdmin(orgId, adminUserId);

    // Check tier
    const tier = await getOrgTier(orgId);
    if (!TIER_LIMITS[tier].canUseApiKeys) {
      throw new HTTP403Error('API keys are available on the Team plan only. Upgrade to Team to use the public API.');
    }

    // Generate key material before transaction to minimize lock time
    const rawHex = crypto.randomBytes(32).toString('hex');
    const rawKey = `sk_live_${rawHex}`;
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const keyPrefix = rawHex.substring(0, 8);

    // Atomic count check + insert to prevent race condition
    const [apiKey] = await db.transaction(async (tx) => {
      const [countResult] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(apiKeys)
        .where(eq(apiKeys.orgId, orgId));

      if ((countResult?.count ?? 0) >= MAX_API_KEYS_PER_ORG) {
        throw new HTTP400Error(`Maximum ${MAX_API_KEYS_PER_ORG} API keys per organization. Revoke an existing key to create a new one.`);
      }

      return tx
        .insert(apiKeys)
        .values({
          orgId,
          name,
          description: description || null,
          keyHash,
          keyPrefix,
          createdBy: adminUserId,
        })
        .returning();
    });

    // Get creator name
    const [creator] = await db
      .select({ fullName: users.fullName })
      .from(users)
      .where(eq(users.id, adminUserId))
      .limit(1);

    return {
      apiKey: {
        id: apiKey.id,
        orgId: apiKey.orgId,
        name: apiKey.name,
        description: apiKey.description,
        keyPrefix: apiKey.keyPrefix,
        createdBy: apiKey.createdBy,
        creatorName: creator?.fullName || null,
        lastUsedAt: apiKey.lastUsedAt?.toISOString() || null,
        createdAt: apiKey.createdAt.toISOString(),
      },
      rawKey,
    };
  },

  /**
   * List API keys for an organization (any member can view)
   */
  async listApiKeys(orgId: string) {
    const rows = await db
      .select({
        id: apiKeys.id,
        orgId: apiKeys.orgId,
        name: apiKeys.name,
        description: apiKeys.description,
        keyPrefix: apiKeys.keyPrefix,
        createdBy: apiKeys.createdBy,
        creatorName: users.fullName,
        lastUsedAt: apiKeys.lastUsedAt,
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys)
      .leftJoin(users, eq(apiKeys.createdBy, users.id))
      .where(eq(apiKeys.orgId, orgId));

    return rows.map((row) => ({
      ...row,
      lastUsedAt: row.lastUsedAt?.toISOString() || null,
      createdAt: row.createdAt.toISOString(),
    }));
  },

  /**
   * Revoke (delete) an API key — admin-only
   */
  async revokeApiKey(orgId: string, adminUserId: string, keyId: string) {
    await verifyOrgAdmin(orgId, adminUserId);

    const result = await db
      .delete(apiKeys)
      .where(
        and(
          eq(apiKeys.id, keyId),
          eq(apiKeys.orgId, orgId)
        )
      )
      .returning({ id: apiKeys.id });

    if (result.length === 0) {
      throw new HTTP404Error('API key not found');
    }
  },

  /**
   * Validate an API key — returns orgId and keyId if valid, null otherwise
   */
  async validateApiKey(rawKey: string): Promise<{ orgId: string; keyId: string } | null> {
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    const [row] = await db
      .select({ id: apiKeys.id, orgId: apiKeys.orgId })
      .from(apiKeys)
      .where(eq(apiKeys.keyHash, keyHash))
      .limit(1);

    if (!row) return null;
    return { orgId: row.orgId, keyId: row.id };
  },

  /**
   * Update lastUsedAt timestamp (fire-and-forget)
   */
  touchLastUsed(keyId: string): void {
    db.update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, keyId))
      .then(() => {})
      .catch((err) => {
        logger.error('Failed to update API key lastUsedAt', { error: (err as Error).message, keyId });
      });
  },
};
