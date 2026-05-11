import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SECRETS_DIR = '/run/secrets';

// Load .env from monorepo root in development only.
if ((process.env.NODE_ENV ?? 'development') !== 'production') {
  try {
     
    const dotenv = await import(/* webpackIgnore: true */ 'dotenv' as string);
    (dotenv.config as (opts: { path: string }) => void)({ path: resolve(__dirname, '../../../../../.env') });
  } catch {
    // Ignore if dotenv isn't installed or .env isn't present
  }
}

function readSecret(envKey: string, secretName: string, defaultValue: string = ''): string {
  try {
    return readFileSync(`${SECRETS_DIR}/${secretName}`, 'utf8').trim();
  } catch {
    // Secret file not found — fall back to environment variable
  }
  return process.env[envKey] || defaultValue;
}

function readRequiredSecret(envKey: string, secretName: string, devDefault: string): string {
  try {
    return readFileSync(`${SECRETS_DIR}/${secretName}`, 'utf8').trim();
  } catch {
    // Secret file not found — fall back to environment variable
  }
  const envVal = process.env[envKey];
  if (envVal) {
    return envVal;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`Secret '${secretName}' (env: ${envKey}) is required in production`);
  }
  return devDefault;
}

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',

  // Telegram
  botToken: readRequiredSecret('TELEGRAM_BOT_TOKEN', 'telegram_bot_token', ''),
  chatId: process.env.TELEGRAM_CHAT_ID || '',
  threadId: process.env.TELEGRAM_THREAD_ID ? parseInt(process.env.TELEGRAM_THREAD_ID, 10) : undefined,

  // Database
  databaseUrl: readSecret('DATABASE_URL', 'database_url', 'postgres://scanorbit:scanorbit@localhost:15432/scanorbit'),

  // Redis
  redisUrl: readSecret('REDIS_URL', 'redis_url', 'redis://localhost:16379'),

  // Summary
  summaryHourCET: parseInt(process.env.SUMMARY_HOUR_CET || '20', 10),

  // Polling intervals
  pollIntervalMs: 60_000,
} as const;
