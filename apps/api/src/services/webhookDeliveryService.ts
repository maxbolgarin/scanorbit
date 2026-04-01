import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { orgWebhooks, webhookDeliveryLogs } from '../db/schema.js';
import { decryptOAuthToken } from '../lib/crypto.js';
import { logger } from '../lib/logger.js';
import { redis } from '../lib/redis.js';

const QUEUE_KEY = 'jobs:webhook_delivery';
const LOCK_KEY = 'webhook:delivery:lock';
const LOCK_TTL_SECONDS = 4;
const WORKER_INTERVAL_MS = 5000;
const MAX_ATTEMPTS = 3;
const DELIVERY_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BODY = 1024;

export const webhookDeliveryService = {
  /**
   * Sign a JSON payload string with HMAC-SHA256.
   * Returns hex digest.
   */
  signPayload(secret: string, payload: string): string {
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  },

  /**
   * Create delivery log record in DB + push deliveryId to Redis queue.
   * Returns deliveryId.
   */
  async enqueueDelivery(webhookId: string, eventType: string, payload: object): Promise<string> {
    const [record] = await db
      .insert(webhookDeliveryLogs)
      .values({
        webhookId,
        eventType,
        payload,
        status: 'pending',
        attempts: 0,
      })
      .returning();

    await redis.rpush(QUEUE_KEY, record.id);

    logger.info('Webhook delivery enqueued', { webhookId, eventType, deliveryId: record.id });

    return record.id;
  },

  /**
   * Pop one delivery from Redis queue and process it.
   * Returns true if something was processed, false if the queue was empty.
   */
  async processOne(): Promise<boolean> {
    const deliveryId = await redis.lpop(QUEUE_KEY);
    if (!deliveryId) return false;

    await webhookDeliveryService.deliverWebhook(deliveryId);
    return true;
  },

  /**
   * Deliver a single webhook.
   * Fetches delivery log, gets webhook URL + decrypted secret, sends HTTP POST.
   */
  async deliverWebhook(deliveryId: string): Promise<void> {
    // 1. Fetch delivery log
    const [delivery] = await db
      .select()
      .from(webhookDeliveryLogs)
      .where(eq(webhookDeliveryLogs.id, deliveryId))
      .limit(1);

    if (!delivery || delivery.status !== 'pending') {
      return;
    }

    // 2. Fetch associated webhook
    const [webhook] = await db
      .select()
      .from(orgWebhooks)
      .where(eq(orgWebhooks.id, delivery.webhookId))
      .limit(1);

    if (!webhook || !webhook.isActive) {
      await db
        .update(webhookDeliveryLogs)
        .set({ status: 'failed', error: 'Webhook not found or inactive' })
        .where(eq(webhookDeliveryLogs.id, deliveryId));
      return;
    }

    // 3. Decrypt secret and build payload
    const decryptedSecret = decryptOAuthToken(webhook.secret);
    const payloadStr = JSON.stringify(delivery.payload);
    const signature = webhookDeliveryService.signPayload(decryptedSecret, payloadStr);

    // 4. HTTP POST with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);

    let statusCode = 0;
    let responseBody = '';
    let success = false;
    let fetchError: string | null = null;

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-ScanOrbit-Signature': `sha256=${signature}`,
          'X-ScanOrbit-Event': delivery.eventType,
          'X-ScanOrbit-Delivery': delivery.id,
        },
        body: payloadStr,
        signal: controller.signal,
      });

      statusCode = response.status;
      success = response.status >= 200 && response.status < 300;

      const raw = await response.text().catch(() => '');
      responseBody = raw.slice(0, MAX_RESPONSE_BODY);
    } catch (err) {
      fetchError = (err as Error).message;
    } finally {
      clearTimeout(timeoutId);
    }

    // 5. Handle success
    if (success) {
      await db
        .update(webhookDeliveryLogs)
        .set({ status: 'success', statusCode, responseBody })
        .where(eq(webhookDeliveryLogs.id, deliveryId));

      logger.info('Webhook delivered successfully', { deliveryId, webhookId: webhook.id, statusCode });
      return;
    }

    // 6. Handle failure — increment attempts
    const newAttempts = delivery.attempts + 1;

    if (newAttempts >= MAX_ATTEMPTS) {
      const errorMsg = fetchError ?? `HTTP ${statusCode}`;
      await db
        .update(webhookDeliveryLogs)
        .set({
          status: 'failed',
          attempts: newAttempts,
          statusCode: statusCode || null,
          error: errorMsg,
        })
        .where(eq(webhookDeliveryLogs.id, deliveryId));

      logger.warn('Webhook delivery failed permanently', {
        deliveryId,
        webhookId: webhook.id,
        attempts: newAttempts,
        error: errorMsg,
      });
      return;
    }

    // Retry with exponential backoff: 5s, 25s, 125s
    const delaySec = 5 * Math.pow(5, newAttempts - 1);
    const nextRetryAt = new Date(Date.now() + delaySec * 1000);
    const errorMsg = fetchError ?? `HTTP ${statusCode}`;

    await db
      .update(webhookDeliveryLogs)
      .set({
        attempts: newAttempts,
        statusCode: statusCode || null,
        nextRetryAt,
        error: errorMsg,
      })
      .where(eq(webhookDeliveryLogs.id, deliveryId));

    // Re-enqueue for retry
    await redis.rpush(QUEUE_KEY, deliveryId);

    logger.info('Webhook delivery will be retried', {
      deliveryId,
      webhookId: webhook.id,
      attempts: newAttempts,
      nextRetryAt,
    });
  },

  /**
   * Start the delivery worker polling loop.
   * Processes up to 10 deliveries per 5-second tick using a Redis distributed lock.
   */
  startDeliveryWorker(): void {
    setInterval(async () => {
      const acquired = await redis.set(LOCK_KEY, '1', 'EX', LOCK_TTL_SECONDS, 'NX');
      if (!acquired) return;
      try {
        for (let i = 0; i < 10; i++) {
          const processed = await webhookDeliveryService.processOne();
          if (!processed) break;
        }
      } catch (err) {
        logger.error('webhook delivery worker error', err as Error);
      }
    }, WORKER_INTERVAL_MS);
  },
};
