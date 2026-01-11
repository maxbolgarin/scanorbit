/**
 * Structured logging utility
 *
 * Provides consistent, secure logging that:
 * - Uses structured JSON format for production
 * - Redacts sensitive fields (passwords, tokens, etc.)
 * - Includes correlation IDs for request tracing
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

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  requestId?: string;
  userId?: string;
  orgId?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  durationMs?: number;
  [key: string]: unknown;
}

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
 * Format log entry
 */
function formatLogEntry(level: LogLevel, message: string, context?: LogContext, error?: Error): string {
  const timestamp = new Date().toISOString();
  const redactedContext = context ? redactSensitiveFields(context) : undefined;

  // Production: JSON format for log aggregation
  if (config.nodeEnv === 'production') {
    const entry = {
      timestamp,
      level,
      message,
      ...(redactedContext as object),
      ...(error && {
        error: {
          name: error.name,
          message: error.message,
          // Don't include stack in production to avoid leaking internal paths
        },
      }),
    };
    return JSON.stringify(entry);
  }

  // Development: Human-readable format
  const levelColors: Record<LogLevel, string> = {
    debug: '\x1b[36m', // Cyan
    info: '\x1b[32m', // Green
    warn: '\x1b[33m', // Yellow
    error: '\x1b[31m', // Red
  };
  const reset = '\x1b[0m';
  const color = levelColors[level];

  let output = `${timestamp} ${color}[${level.toUpperCase()}]${reset} ${message}`;

  if (redactedContext && Object.keys(redactedContext as object).length > 0) {
    output += ` ${JSON.stringify(redactedContext)}`;
  }

  if (error) {
    output += `\n${error.stack || error.message}`;
  }

  return output;
}

interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, error?: Error | unknown, context?: LogContext): void;
  child(boundContext: LogContext): Logger;
}

/**
 * Logger instance
 */
export const logger: Logger = {
  debug(message: string, context?: LogContext): void {
    if (config.nodeEnv === 'development') {
      console.debug(formatLogEntry('debug', message, context));
    }
  },

  info(message: string, context?: LogContext): void {
    console.log(formatLogEntry('info', message, context));
  },

  warn(message: string, context?: LogContext): void {
    console.warn(formatLogEntry('warn', message, context));
  },

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const err = error instanceof Error ? error : undefined;
    const errContext = error && !(error instanceof Error) ? { errorDetails: error } : {};
    console.error(formatLogEntry('error', message, { ...context, ...errContext }, err));
  },

  /**
   * Create a child logger with bound context
   */
  child(boundContext: LogContext): Logger {
    return {
      debug: (message: string, context?: LogContext) =>
        logger.debug(message, { ...boundContext, ...context }),
      info: (message: string, context?: LogContext) =>
        logger.info(message, { ...boundContext, ...context }),
      warn: (message: string, context?: LogContext) =>
        logger.warn(message, { ...boundContext, ...context }),
      error: (message: string, error?: Error | unknown, context?: LogContext) =>
        logger.error(message, error, { ...boundContext, ...context }),
      child: (childContext: LogContext) => logger.child({ ...boundContext, ...childContext }),
    };
  },
};
