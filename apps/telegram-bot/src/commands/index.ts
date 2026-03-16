import { bot } from '../lib/telegram.js';
import { config } from '../lib/config.js';
import { logger } from '../lib/logger.js';
import { helpCommand } from './help.js';
import { statusCommand } from './status.js';
import { usersCommand } from './users.js';
import { orgsCommand } from './orgs.js';
import { scansCommand } from './scans.js';
import { onlineCommand } from './online.js';
import { accountsCommand } from './accounts.js';
import { revenueCommand } from './revenue.js';

export function registerCommands(): void {
  // Security: only respond to the configured admin chat
  bot.use(async (ctx, next) => {
    const chatId = ctx.chat?.id?.toString();
    if (chatId !== config.chatId) {
      logger.debug('[Commands] Ignoring message from unauthorized chat', { chatId });
      return; // silently ignore
    }
    await next();
  });

  bot.command('help', helpCommand);
  bot.command('start', helpCommand);
  bot.command('status', statusCommand);
  bot.command('users', usersCommand);
  bot.command('orgs', orgsCommand);
  bot.command('scans', scansCommand);
  bot.command('online', onlineCommand);
  bot.command('accounts', accountsCommand);
  bot.command('revenue', revenueCommand);

  logger.info('[Commands] Registered all bot commands');
}
