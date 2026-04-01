import crypto from 'node:crypto';
import { eq, and, sql, desc, count } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { orgWebhooks, webhookDeliveryLogs, type OrgWebhook, type WebhookDeliveryLog } from '../db/schema.js';
import { encryptOAuthToken, decryptOAuthToken } from '../lib/crypto.js';
import { logger } from '../lib/logger.js';
import { HTTP400Error, HTTP404Error } from '../lib/errors.js';

const MAX_WEBHOOKS_PER_ORG = 10;
const TEST_TIMEOUT_MS = 10_000;

interface CreateWebhookParams {
  url: string;
  eventTypes: string[];
  description?: string;
  createdBy: string;
}

interface UpdateWebhookParams {
  url?: string;
  eventTypes?: string[];
  isActive?: boolean;
  description?: string;
}

export const webhookService = {
  /**
   * Create a webhook — generates an HMAC secret, encrypts it, stores the webhook.
   * Returns the webhook record plus the raw secret (shown once only).
   * Max 10 webhooks per org.
   */
  async createWebhook(
    orgId: string,
    params: CreateWebhookParams
  ): Promise<{ webhook: OrgWebhook; secret: string }> {
    // Check webhook limit
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(orgWebhooks)
      .where(eq(orgWebhooks.orgId, orgId));

    if ((countResult?.count ?? 0) >= MAX_WEBHOOKS_PER_ORG) {
      throw new HTTP400Error(`Maximum ${MAX_WEBHOOKS_PER_ORG} webhooks per organization. Delete an existing webhook to create a new one.`);
    }

    // Generate secret
    const rawSecret = crypto.randomBytes(32).toString('hex');
    const encryptedSecret = encryptOAuthToken(rawSecret);

    const [webhook] = await db
      .insert(orgWebhooks)
      .values({
        orgId,
        url: params.url,
        secret: encryptedSecret,
        eventTypes: params.eventTypes,
        description: params.description ?? null,
        createdBy: params.createdBy,
      })
      .returning();

    logger.info('Webhook created', { orgId, webhookId: webhook.id });

    return { webhook, secret: rawSecret };
  },

  /**
   * List all webhooks for an org. The secret is NOT included in the response.
   */
  async listWebhooks(orgId: string): Promise<OrgWebhook[]> {
    return db
      .select()
      .from(orgWebhooks)
      .where(eq(orgWebhooks.orgId, orgId))
      .orderBy(desc(orgWebhooks.createdAt));
  },

  /**
   * Update webhook fields (url, eventTypes, isActive, description).
   * Verifies the webhook belongs to the org.
   */
  async updateWebhook(
    orgId: string,
    webhookId: string,
    params: UpdateWebhookParams
  ): Promise<OrgWebhook> {
    const updates: Partial<typeof orgWebhooks.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (params.url !== undefined) updates.url = params.url;
    if (params.eventTypes !== undefined) updates.eventTypes = params.eventTypes;
    if (params.isActive !== undefined) updates.isActive = params.isActive;
    if (params.description !== undefined) updates.description = params.description;

    const [updated] = await db
      .update(orgWebhooks)
      .set(updates)
      .where(and(eq(orgWebhooks.id, webhookId), eq(orgWebhooks.orgId, orgId)))
      .returning();

    if (!updated) {
      throw new HTTP404Error('Webhook not found');
    }

    logger.info('Webhook updated', { orgId, webhookId });
    return updated;
  },

  /**
   * Delete a webhook. Verifies the webhook belongs to the org.
   */
  async deleteWebhook(orgId: string, webhookId: string): Promise<void> {
    const result = await db
      .delete(orgWebhooks)
      .where(and(eq(orgWebhooks.id, webhookId), eq(orgWebhooks.orgId, orgId)))
      .returning({ id: orgWebhooks.id });

    if (result.length === 0) {
      throw new HTTP404Error('Webhook not found');
    }

    logger.info('Webhook deleted', { orgId, webhookId });
  },

  /**
   * Send a test event to the webhook (synchronous, 10s timeout).
   * Decrypts the stored secret, signs the payload with HMAC-SHA256, POSTs it.
   * Returns statusCode and whether delivery was successful (2xx).
   */
  async testWebhook(
    orgId: string,
    webhookId: string
  ): Promise<{ statusCode: number; success: boolean }> {
    const [webhook] = await db
      .select()
      .from(orgWebhooks)
      .where(and(eq(orgWebhooks.id, webhookId), eq(orgWebhooks.orgId, orgId)))
      .limit(1);

    if (!webhook) {
      throw new HTTP404Error('Webhook not found');
    }

    const rawSecret = decryptOAuthToken(webhook.secret);

    const payload = {
      id: crypto.randomUUID(),
      event: 'test',
      timestamp: new Date().toISOString(),
      data: { message: 'Test webhook delivery from ScanOrbit' },
    };

    const body = JSON.stringify(payload);
    const signature = crypto
      .createHmac('sha256', rawSecret)
      .update(body)
      .digest('hex');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TEST_TIMEOUT_MS);

    let statusCode = 0;
    let success = false;

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-ScanOrbit-Signature': `sha256=${signature}`,
          'X-ScanOrbit-Event': 'test',
        },
        body,
        signal: controller.signal,
      });

      statusCode = response.status;
      success = response.status >= 200 && response.status < 300;
    } catch (err) {
      logger.warn('Webhook test delivery failed', { webhookId, error: (err as Error).message });
    } finally {
      clearTimeout(timeoutId);
    }

    return { statusCode, success };
  },

  /**
   * Get paginated delivery logs for a webhook.
   * Verifies the webhook belongs to the org.
   */
  async getDeliveryLogs(
    orgId: string,
    webhookId: string,
    page: number,
    limit: number
  ): Promise<{ data: WebhookDeliveryLog[]; total: number }> {
    // Verify ownership
    const [webhook] = await db
      .select({ id: orgWebhooks.id })
      .from(orgWebhooks)
      .where(and(eq(orgWebhooks.id, webhookId), eq(orgWebhooks.orgId, orgId)))
      .limit(1);

    if (!webhook) {
      throw new HTTP404Error('Webhook not found');
    }

    const offset = (page - 1) * limit;

    const [data, totalResult] = await Promise.all([
      db
        .select()
        .from(webhookDeliveryLogs)
        .where(eq(webhookDeliveryLogs.webhookId, webhookId))
        .orderBy(desc(webhookDeliveryLogs.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: count() })
        .from(webhookDeliveryLogs)
        .where(eq(webhookDeliveryLogs.webhookId, webhookId)),
    ]);

    return { data, total: totalResult[0]?.count ?? 0 };
  },
};
