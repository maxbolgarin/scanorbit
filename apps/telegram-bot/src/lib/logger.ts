import { config } from './config.js';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const minLevel = LOG_LEVELS[config.logLevel as LogLevel] ?? LOG_LEVELS.info;

function log(level: LogLevel, message: string, extra?: Record<string, unknown>): void {
  if (LOG_LEVELS[level] < minLevel) return;

  const entry = {
    level,
    time: new Date().toISOString(),
    service: 'telegram-bot',
    message,
    ...extra,
  };

  const output = JSON.stringify(entry);
  if (level === 'error') console.error(output);
  else if (level === 'warn') console.warn(output);
  else console.log(output);
}

export const logger = {
  debug: (msg: string, extra?: Record<string, unknown>) => log('debug', msg, extra),
  info: (msg: string, extra?: Record<string, unknown>) => log('info', msg, extra),
  warn: (msg: string, extra?: Record<string, unknown>) => log('warn', msg, extra),
  error: (msg: string, err?: Error | unknown, extra?: Record<string, unknown>) => {
    const errorContext = { ...extra };
    if (err instanceof Error) errorContext.error = err.message;
    else if (err !== undefined) errorContext.error = String(err);
    log('error', msg, errorContext);
  },
};
