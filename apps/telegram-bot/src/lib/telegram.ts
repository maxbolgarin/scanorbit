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

/**
 * Mask email for GDPR compliance: "user@example.com" -> "u***r@example.com"
 */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain || local.length <= 2) return `***@${domain || '***'}`;
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}
