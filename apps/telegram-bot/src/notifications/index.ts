import { redisSub } from '../lib/redis.js';
import { sendAdminMessage } from '../lib/telegram.js';
import { logger } from '../lib/logger.js';
import { formatEvent } from './formatters.js';
import type { TelegramEvent } from '../types.js';

const CHANNEL = 'telegram:events';

export function startNotificationSubscriber(): void {
  redisSub.subscribe(CHANNEL, (err) => {
    if (err) {
      logger.error('[Notifications] Failed to subscribe to channel', err);
      return;
    }
    logger.info(`[Notifications] Subscribed to ${CHANNEL}`);
  });

  redisSub.on('message', (channel, message) => {
    if (channel !== CHANNEL) return;

    try {
      const event = JSON.parse(message) as TelegramEvent;
      const text = formatEvent(event);
      sendAdminMessage(text).catch((err) =>
        logger.error('[Notifications] Failed to send', err)
      );
    } catch (err) {
      logger.error('[Notifications] Failed to parse event', err, { message });
    }
  });
}
