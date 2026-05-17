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

  // Authentication.
  //   AUTH_ENABLED=false (DEFAULT): single-user mode. The app auto-logs in as
  //     a built-in admin and the login/signup screens are unreachable. Use this
  //     for local development or deployments behind a private network / VPN.
  //   AUTH_ENABLED=true: full multi-user mode with sign-up, login, OAuth, 2FA.
  // **Never expose AUTH_ENABLED=false to the public internet — anyone with
  // network access becomes an admin.**
  authEnabled: process.env.AUTH_ENABLED === 'true',

  // Database (secret: contains password in connection string)
  databaseUrl: readSecret('DATABASE_URL', 'database_url', 'postgres://scanorbit:scanorbit@localhost:5432/scanorbit'),

  // Redis (secret: contains password in connection string)
  redisUrl: readSecret('REDIS_URL', 'redis_url', 'redis://localhost:6379'),

  // JWT Access Token Secret - required (signs 5-min access tokens)
  jwtSecret: readRequiredSecret('JWT_SECRET', 'jwt_secret'),

  // Access token expiry in minutes (default: 5 minutes)
  // Frontend must use the same value for proactive token refresh
  accessTokenExpiryMinutes: parseInt(process.env.ACCESS_TOKEN_EXPIRY_MINUTES || '5', 10),

  // JWT Refresh Token Secret - required (signs 7-day refresh tokens in httpOnly cookie)
  jwtRefreshSecret: readRequiredSecret('JWT_REFRESH_SECRET', 'jwt_refresh_secret'),

  // Two-Factor Authentication - required, 32 bytes hex for AES-256
  totpEncryptionKey: readRequiredSecret('TOTP_ENCRYPTION_KEY', 'totp_encryption_key'),

  // OAuth Token Encryption - required, 32 bytes hex for AES-256
  // Encrypts OAuth refresh tokens, AWS account external IDs, webhook secrets, Slack tokens
  oauthEncryptionKey: readRequiredSecret('OAUTH_ENCRYPTION_KEY', 'oauth_encryption_key'),

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

  // Cookie domain - set to a parent domain (e.g., '.example.com') if the API
  // and the app live on different subdomains. Leave empty for single-host
  // deployments and local development.
  cookieDomain: process.env.COOKIE_DOMAIN || '',

  // Email Configuration (Resend)
  email: {
    from: process.env.EMAIL_FROM || 'ScanOrbit <noreply@localhost>',
    resend: {
      apiKey: readSecret('RESEND_API_KEY', 'resend_api_key'),
      webhookSecret: readSecret('RESEND_WEBHOOK_SECRET', 'resend_webhook_secret'),
    },
  },

  // Slack Integration
  slack: {
    clientId: process.env.SLACK_CLIENT_ID || '',
    clientSecret: readSecret('SLACK_CLIENT_SECRET', 'slack_client_secret'),
    signingSecret: readSecret('SLACK_SIGNING_SECRET', 'slack_signing_secret'),
  },

  // Bug report notification recipient. Self-host operators set this to their
  // own ops/support inbox via BUG_REPORT_EMAIL. Defaults to disabled.
  bugReportEmail: process.env.BUG_REPORT_EMAIL || '',

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

export type Config = typeof config;
