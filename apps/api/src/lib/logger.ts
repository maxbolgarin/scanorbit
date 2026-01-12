import { config } from './config.js';

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

interface LogContext {
  [key: string]: unknown;
}

interface LogEntry {
  level: LogLevel;
  time: string;
  service: string;
  message: string;
  [key: string]: unknown;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

class Logger {
  private service: string;
  private minLevel: number;
  private context: LogContext;

  constructor(service: string, context: LogContext = {}) {
    this.service = service;
    this.context = context;
    this.minLevel = LOG_LEVELS[config.logLevel as LogLevel] ?? LOG_LEVELS.info;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= this.minLevel;
  }

  private formatLog(level: LogLevel, message: string, extra: LogContext = {}): string {
    const entry: LogEntry = {
      level,
      time: new Date().toISOString(),
      service: this.service,
      message,
      ...this.context,
      ...extra,
    };

    // Remove undefined values
    Object.keys(entry).forEach((key) => {
      if (entry[key] === undefined) {
        delete entry[key];
      }
    });

    return JSON.stringify(entry);
  }

  private log(level: LogLevel, message: string, extra: LogContext = {}): void {
    if (!this.shouldLog(level)) return;

    const output = this.formatLog(level, message, extra);

    switch (level) {
      case 'debug':
      case 'info':
        console.log(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      case 'error':
      case 'fatal':
        console.error(output);
        break;
    }
  }

  /**
   * Create a child logger with additional context
   */
  with(context: LogContext): Logger {
    const child = new Logger(this.service, { ...this.context, ...context });
    child.minLevel = this.minLevel;
    return child;
  }

  /**
   * Log at debug level
   */
  debug(message: string, extra?: LogContext): void {
    this.log('debug', message, extra);
  }

  /**
   * Log at info level
   */
  info(message: string, extra?: LogContext): void {
    this.log('info', message, extra);
  }

  /**
   * Log at warn level
   */
  warn(message: string, extra?: LogContext): void {
    this.log('warn', message, extra);
  }

  /**
   * Log at error level
   */
  error(message: string, error?: Error | unknown, extra?: LogContext): void {
    const errorContext: LogContext = { ...extra };

    if (error instanceof Error) {
      errorContext.error = error.message;
      errorContext.stack = error.stack;
    } else if (error !== undefined) {
      errorContext.error = String(error);
    }

    this.log('error', message, errorContext);
  }

  /**
   * Log at fatal level (and optionally exit)
   */
  fatal(message: string, error?: Error | unknown, extra?: LogContext): void {
    const errorContext: LogContext = { ...extra };

    if (error instanceof Error) {
      errorContext.error = error.message;
      errorContext.stack = error.stack;
    } else if (error !== undefined) {
      errorContext.error = String(error);
    }

    this.log('fatal', message, errorContext);
  }
}

// Create the default logger instance
export const logger = new Logger('api');

// Export the Logger class for creating child loggers
export { Logger };
export type { LogLevel, LogContext };
