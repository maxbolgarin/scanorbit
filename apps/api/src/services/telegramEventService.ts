import { redis } from '../lib/redis.js';
import { logger } from '../lib/logger.js';

export type TelegramEvent =
  | { type: 'user_signup'; userId: string; method: 'email' | 'google' | 'github' }
  | { type: 'scan_started'; orgId: string; scanId: string }
  | { type: 'aws_account_connected'; orgId: string; awsAccountId: string }
  | { type: 'subscription_change'; orgId: string; tier: string; event: 'trial_started' | 'activated' | 'canceled' | 'payment_failed' }
  | { type: 'stuck_jobs'; stuckJobsRecovered: number; stuckScansErrored: number; jobsMovedToDLQ: number };

const CHANNEL = 'telegram:events';

/**
 * Publish an event to the Telegram bot via Redis pub/sub.
 * Fire-and-forget: never throws, never blocks the caller.
 */
export function publishTelegramEvent(event: TelegramEvent): void {
  redis.publish(CHANNEL, JSON.stringify({ ...event, timestamp: new Date().toISOString() }))
    .catch(err => logger.warn('[Telegram] Failed to publish event', { error: (err as Error).message }));
}
