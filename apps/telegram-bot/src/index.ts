import { bot, sendAdminMessage } from './lib/telegram.js';
import { config } from './lib/config.js';
import { logger } from './lib/logger.js';
import { pool } from './lib/db.js';
import { redis, redisSub } from './lib/redis.js';
import { registerCommands } from './commands/index.js';
import { startNotificationSubscriber } from './notifications/index.js';
import { startSummaryCron } from './summary/index.js';
import { startScanCompletionPolling } from './poll/scanCompletions.js';

// Validate required config
if (!config.botToken) {
  logger.error('TELEGRAM_BOT_TOKEN is required');
  process.exit(1);
}
if (!config.chatId) {
  logger.warn('TELEGRAM_CHAT_ID not set — bot will not send notifications');
}

logger.info('Starting ScanOrbit Telegram Bot', {
  env: config.nodeEnv,
  chatId: config.chatId ? `${config.chatId.slice(0, 4)}...` : 'not set',
  summaryHour: config.summaryHourCET,
});

// Register bot commands (with security middleware)
registerCommands();

// Start Redis pub/sub notification subscriber
startNotificationSubscriber();

// Start evening summary cron
startSummaryCron();

// Start scan completion polling
startScanCompletionPolling();

// Start the bot (long polling)
bot.start({
  onStart: () => {
    logger.info('Bot started (long polling)');
    sendAdminMessage('<b>Bot started</b>').catch(() => undefined);
  },
});

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`${signal} received, shutting down`);

  bot.stop();

  await Promise.allSettled([
    pool.end(),
    redis.quit(),
    redisSub.quit(),
  ]);

  logger.info('Shutdown complete');
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', reason as Error);
  process.exit(1);
});
