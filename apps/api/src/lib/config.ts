import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { readSecret, readRequiredSecret } from './secrets.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env from monorepo root in development only.
// In production (Docker), configuration should come from Docker secrets or environment variables,
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

  // Database (secret: contains password in connection string)
  databaseUrl: readSecret('DATABASE_URL', 'database_url', 'postgres://scanorbit:scanorbit@localhost:5432/scanorbit'),

  // Redis (secret: contains password in connection string)
  redisUrl: readSecret('REDIS_URL', 'redis_url', 'redis://localhost:6379'),

  // JWT Access Token Secret - MUST be set in production
  // Used for signing short-lived access tokens (5 min expiry, hardcoded in jwt.ts)
  jwtSecret: readRequiredSecret('JWT_SECRET', 'jwt_secret', 'dev-only-jwt-secret-do-not-use-in-production'),

  // Access token expiry in minutes (default: 5 minutes)
  // Frontend must use the same value for proactive token refresh
  accessTokenExpiryMinutes: parseInt(process.env.ACCESS_TOKEN_EXPIRY_MINUTES || '5', 10),

  // JWT Refresh Token Secret - MUST be set in production (separate secret for refresh tokens)
  // Used for signing long-lived refresh tokens (7 day expiry, stored in httpOnly cookie)
  jwtRefreshSecret: readRequiredSecret('JWT_REFRESH_SECRET', 'jwt_refresh_secret', 'dev-only-jwt-refresh-secret-do-not-use-in-production'),

  // Two-Factor Authentication - MUST be set in production (32 bytes hex for AES-256)
  totpEncryptionKey: readRequiredSecret('TOTP_ENCRYPTION_KEY', 'totp_encryption_key',
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'), // 64 hex chars = 32 bytes

  // OAuth Token Encryption - MUST be set in production (32 bytes hex for AES-256)
  // This encrypts OAuth access tokens and refresh tokens stored in the database
  oauthEncryptionKey: readRequiredSecret('OAUTH_ENCRYPTION_KEY', 'oauth_encryption_key',
    'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210'), // 64 hex chars = 32 bytes

  // Google OAuth
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: readSecret('GOOGLE_CLIENT_SECRET', 'google_client_secret'),
    callbackUrl: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:4000/api/auth/google/callback',
  },

  // GitHub OAuth
  github: {
    clientId: process.env.GITHUB_CLIENT_ID || '',
    clientSecret: readSecret('GITHUB_CLIENT_SECRET', 'github_client_secret'),
    callbackUrl: process.env.GITHUB_CALLBACK_URL || 'http://localhost:4000/api/auth/github/callback',
  },

  // AWS
  awsRegion: process.env.AWS_REGION || 'eu-central-1',

  // Frontend - remove trailing slashes to prevent double-slash redirects
  frontendUrl: (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/+$/, ''),

  // Cookie domain - set to parent domain (e.g., '.scanorbit.cloud') for cross-subdomain auth
  // This allows cookies set by api.scanorbit.cloud to be sent from app.scanorbit.cloud
  // Leave empty for localhost development (uses default behavior)
  cookieDomain: process.env.COOKIE_DOMAIN || '',

  // Email Configuration
  email: {
    // Provider: 'resend' (HTTP API, bypasses SMTP port blocks) or 'smtp'
    provider: (process.env.EMAIL_PROVIDER || 'smtp') as 'resend' | 'smtp',
    // Shared "from" address for all providers
    from: process.env.EMAIL_FROM || process.env.SMTP_FROM || (process.env.SMTP_USER ? `ScanOrbit <${process.env.SMTP_USER}>` : 'ScanOrbit <noreply@scanorbit.io>'),
    // Resend HTTP API configuration
    resend: {
      apiKey: process.env.RESEND_API_KEY || '',
    },
    // SMTP configuration (backwards compatible)
    smtp: {
      enabled: process.env.SMTP_ENABLED !== 'false',
      host: process.env.SMTP_HOST || '',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER || '',
      pass: readSecret('SMTP_PASS', 'smtp_pass'),
    },
  },

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',

  // Trusted Proxies (comma-separated list of IPs/CIDRs)
  // Only trust x-forwarded-for header from these addresses
  // Common values: "127.0.0.1", "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"
  trustedProxies: (process.env.TRUSTED_PROXIES || '127.0.0.1,::1').split(',').map(s => s.trim()).filter(Boolean),

  // GDPR Compliance - Data Retention (days)
  retentionResourcesDays: parseInt(process.env.RETENTION_RESOURCES_DAYS || '90', 10),
  retentionFindingsResolvedDays: parseInt(process.env.RETENTION_FINDINGS_RESOLVED_DAYS || '180', 10),
  retentionScansDays: parseInt(process.env.RETENTION_SCANS_DAYS || '365', 10),
  retentionAuditLogsDays: parseInt(process.env.RETENTION_AUDIT_LOGS_DAYS || '730', 10), // 2 years (GDPR compliance)
} as const;


// Stripe configuration
export const stripeConfig = {
  secretKey: readSecret('STRIPE_SECRET_KEY', 'stripe_secret_key'),
  webhookSecret: readSecret('STRIPE_WEBHOOK_SECRET', 'stripe_webhook_secret'),
  proPriceId: process.env.STRIPE_PRO_PRICE_ID || '',
  teamPriceId: process.env.STRIPE_TEAM_PRICE_ID || '',
  trialDays: parseInt(process.env.STRIPE_TRIAL_DAYS || '7', 10),
} as const;

// Listmonk newsletter configuration
export const listmonkConfig = {
  apiUrl: process.env.LISTMONK_API_URL || 'http://localhost:9000',
  apiUser: process.env.LISTMONK_ADMIN_USER || process.env.LISTMONK_API_USER || 'admin',
  apiPassword: process.env.LISTMONK_ADMIN_PASSWORD || process.env.LISTMONK_API_PASSWORD || '',
  // Campaign list IDs (0 = not configured, skip operations)
  lists: {
    coldLeads: parseInt(process.env.LISTMONK_LIST_COLD_LEADS || '0', 10),
    subscribers: parseInt(process.env.LISTMONK_LIST_SUBSCRIBERS || '0', 10),
    freeNew: parseInt(process.env.LISTMONK_LIST_FREE_NEW || '0', 10),
    freeScanned: parseInt(process.env.LISTMONK_LIST_FREE_SCANNED || '0', 10),
    trialNew: parseInt(process.env.LISTMONK_LIST_TRIAL_NEW || '0', 10),
    trialActive: parseInt(process.env.LISTMONK_LIST_TRIAL_ACTIVE || '0', 10),
    paidPro: parseInt(process.env.LISTMONK_LIST_PAID_PRO || '0', 10),
    paidTeam: parseInt(process.env.LISTMONK_LIST_PAID_TEAM || '0', 10),
  },
  // Transactional template IDs (0 = not configured, skip operations)
  templates: {
    coldDay0Pain: parseInt(process.env.LISTMONK_TEMPLATE_COLD_DAY0_PAIN || '0', 10),
    coldDay4Gdpr: parseInt(process.env.LISTMONK_TEMPLATE_COLD_DAY4_GDPR || '0', 10),
    coldDay10Breakup: parseInt(process.env.LISTMONK_TEMPLATE_COLD_DAY10_BREAKUP || '0', 10),
    subsDay0Welcome: parseInt(process.env.LISTMONK_TEMPLATE_SUBS_DAY0_WELCOME || '0', 10),
    subsDay3Security: parseInt(process.env.LISTMONK_TEMPLATE_SUBS_DAY3_SECURITY || '0', 10),
    subsDay7Cost: parseInt(process.env.LISTMONK_TEMPLATE_SUBS_DAY7_COST || '0', 10),
    subsDay11Gdpr: parseInt(process.env.LISTMONK_TEMPLATE_SUBS_DAY11_GDPR || '0', 10),
    subsDay16SocialProof: parseInt(process.env.LISTMONK_TEMPLATE_SUBS_DAY16_SOCIAL_PROOF || '0', 10),
    subsDay21FinalCta: parseInt(process.env.LISTMONK_TEMPLATE_SUBS_DAY21_FINAL_CTA || '0', 10),
    freeNewDay0Welcome: parseInt(process.env.LISTMONK_TEMPLATE_FREE_NEW_DAY0_WELCOME || '0', 10),
    freeNewDay2Security: parseInt(process.env.LISTMONK_TEMPLATE_FREE_NEW_DAY2_SECURITY || '0', 10),
    freeNewDay5Value: parseInt(process.env.LISTMONK_TEMPLATE_FREE_NEW_DAY5_VALUE || '0', 10),
    freeScannedDay0Results: parseInt(process.env.LISTMONK_TEMPLATE_FREE_SCANNED_DAY0_RESULTS || '0', 10),
    freeScannedDay2Critical: parseInt(process.env.LISTMONK_TEMPLATE_FREE_SCANNED_DAY2_CRITICAL || '0', 10),
    freeScannedDay5Cost: parseInt(process.env.LISTMONK_TEMPLATE_FREE_SCANNED_DAY5_COST || '0', 10),
    freeScannedDay10Breakup: parseInt(process.env.LISTMONK_TEMPLATE_FREE_SCANNED_DAY10_BREAKUP || '0', 10),
    trialNewDay0Welcome: parseInt(process.env.LISTMONK_TEMPLATE_TRIAL_NEW_DAY0_WELCOME || '0', 10),
    trialNewDay3Stuck: parseInt(process.env.LISTMONK_TEMPLATE_TRIAL_NEW_DAY3_STUCK || '0', 10),
    trialActiveDay3Deepen: parseInt(process.env.LISTMONK_TEMPLATE_TRIAL_ACTIVE_DAY3_DEEPEN || '0', 10),
    trialActiveDay5Warning: parseInt(process.env.LISTMONK_TEMPLATE_TRIAL_ACTIVE_DAY5_WARNING || '0', 10),
    trialActiveDay6Lastday: parseInt(process.env.LISTMONK_TEMPLATE_TRIAL_ACTIVE_DAY6_LASTDAY || '0', 10),
    trialActiveDay9Winback: parseInt(process.env.LISTMONK_TEMPLATE_TRIAL_ACTIVE_DAY9_WINBACK || '0', 10),
    paidProDay0Welcome: parseInt(process.env.LISTMONK_TEMPLATE_PAID_PRO_DAY0_WELCOME || '0', 10),
    paidTeamDay0Welcome: parseInt(process.env.LISTMONK_TEMPLATE_PAID_TEAM_DAY0_WELCOME || '0', 10),
  },
} as const;

export type Config = typeof config;
