/**
 * Structured logging utility
 *
 * Provides consistent, secure logging that:
 * - Uses structured JSON format for log aggregation
 * - Redacts sensitive fields (passwords, tokens, etc.)
 * - Includes correlation IDs for request tracing
 * - Supports log level filtering
 * - Prevents accidental exposure of sensitive data
 */

import { config } from './config.js';

// Fields that should be redacted from logs
const SENSITIVE_FIELDS = [
  'password',
  'passwordHash',
  'token',
  'jwt',
  'authorization',
  'cookie',
  'secret',
  'apiKey',
  'api_key',
  'accessToken',
  'refreshToken',
  'signupToken',
  'verificationCode',
  'emailVerificationCode',
  'externalId',
];

// Pattern to match sensitive data in strings
const SENSITIVE_PATTERNS = [
  /Bearer\s+[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/gi, // JWT tokens
  /eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/gi, // JWT without Bearer
];

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogContext {
  requestId?: string;
  userId?: string;
  orgId?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  durationMs?: number;
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

/**
 * Redact sensitive fields from an object
 */
function redactSensitiveFields(obj: unknown, depth = 0): unknown {
  // Prevent infinite recursion
  if (depth > 10) return '[MAX_DEPTH]';

  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    // Redact patterns in strings
    let result = obj;
    for (const pattern of SENSITIVE_PATTERNS) {
      result = result.replace(pattern, '[REDACTED]');
    }
    return result;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => redactSensitiveFields(item, depth + 1));
  }

  if (typeof obj === 'object') {
    const redacted: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_FIELDS.some((field) => lowerKey.includes(field.toLowerCase()))) {
        redacted[key] = '[REDACTED]';
      } else {
        redacted[key] = redactSensitiveFields(value, depth + 1);
      }
    }
    return redacted;
  }

  return obj;
}

/**
 * Logger class with redaction, log level filtering, and structured JSON output
 */
export class Logger {
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
    // Merge context and extra fields
    const mergedContext: LogContext = { ...this.context, ...extra };

    // Redact sensitive fields from the merged context
    const redactedContext = redactSensitiveFields(mergedContext) as LogContext;

    const entry: LogEntry = {
      level,
      time: new Date().toISOString(),
      service: this.service,
      message,
      ...redactedContext,
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
   * Create a child logger with bound context (alias for with)
   */
  child(boundContext: LogContext): Logger {
    return this.with(boundContext);
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
    } else if (error !== undefined) {
      errorContext.error = String(error);
    }

    this.log('error', message, errorContext);
  }

  /**
   * Log at fatal level
   */
  fatal(message: string, error?: Error | unknown, extra?: LogContext): void {
    const errorContext: LogContext = { ...extra };

    if (error instanceof Error) {
      errorContext.error = error.message;
    } else if (error !== undefined) {
      errorContext.error = String(error);
    }

    this.log('fatal', message, errorContext);
  }
}

// Create the default logger instance
export const logger = new Logger('api');
