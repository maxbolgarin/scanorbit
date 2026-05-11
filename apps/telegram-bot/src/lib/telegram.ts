import { Bot } from 'grammy';
import { config } from './config.js';
import { logger } from './logger.js';

export const bot = new Bot(config.botToken);

/**
 * Send a message to the admin chat. Fire-and-forget safe.
 */
export async function sendAdminMessage(text: string): Promise<void> {
  if (!config.chatId) {
    logger.warn('[Telegram] TELEGRAM_CHAT_ID not set, skipping message');
    return;
  }

  try {
    await bot.api.sendMessage(config.chatId, text, {
      parse_mode: 'HTML',
      ...(config.threadId ? { message_thread_id: config.threadId } : {}),
    });
  } catch (err) {
    logger.error('[Telegram] Failed to send message', err);
  }
}
