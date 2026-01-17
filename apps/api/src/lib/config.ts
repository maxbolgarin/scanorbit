import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env from monorepo root in development only.
// In production (Docker), configuration should come from real environment variables,
// and `dotenv` is not installed in the production image (`pnpm install --prod`).
if ((process.env.NODE_ENV ?? 'development') !== 'production') {
  try {
    const { config: dotenvConfig } = await import('dotenv');
    dotenvConfig({ path: resolve(__dirname, '../../../../.env') });
  } catch {
    // Ignore if dotenv isn't installed or .env isn't present (e.g., some CI environments).
  }
}

export const config = {
  // Server
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // Database
  databaseUrl: process.env.DATABASE_URL || 'postgres://scanorbit:scanorbit@localhost:5432/scanorbit',

  // Redis
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  // JWT - MUST be set in production
  jwtSecret: process.env.JWT_SECRET || (
    process.env.NODE_ENV === 'production'
      ? (() => { throw new Error('JWT_SECRET environment variable is required in production'); })()
      : 'dev-only-jwt-secret-do-not-use-in-production'
  ),
  jwtExpiry: process.env.JWT_EXPIRY || '7d',

  // AWS
  awsRegion: process.env.AWS_REGION || 'eu-central-1',

  // Frontend
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',

  // Email (SMTP)
  smtp: {
    enabled: process.env.SMTP_ENABLED !== 'false', // Default true if SMTP_HOST is set
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    // Default to SMTP user's email if SMTP_FROM is not set, to avoid sender address rejection
    from: process.env.SMTP_FROM || (process.env.SMTP_USER ? `ScanOrbit <${process.env.SMTP_USER}>` : 'ScanOrbit <noreply@scanorbit.io>'),
  },

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',

  // GDPR Compliance - Data Retention (days)
  retentionResourcesDays: parseInt(process.env.RETENTION_RESOURCES_DAYS || '90', 10),
  retentionFindingsResolvedDays: parseInt(process.env.RETENTION_FINDINGS_RESOLVED_DAYS || '180', 10),
  retentionScansDays: parseInt(process.env.RETENTION_SCANS_DAYS || '365', 10),
  retentionAuditLogsDays: parseInt(process.env.RETENTION_AUDIT_LOGS_DAYS || '180', 10), // 6 months
} as const;

export type Config = typeof config;
