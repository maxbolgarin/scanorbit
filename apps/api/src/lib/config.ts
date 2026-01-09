import { config as dotenvConfig } from 'dotenv';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env from monorepo root (4 levels up: lib -> src -> api -> apps -> root)
dotenvConfig({ path: resolve(__dirname, '../../../../.env') });

export const config = {
  // Server
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // Database
  databaseUrl: process.env.DATABASE_URL || 'postgres://scanorbit:scanorbit@localhost:5432/scanorbit',

  // Redis
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  // JWT
  jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
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
} as const;

export type Config = typeof config;
