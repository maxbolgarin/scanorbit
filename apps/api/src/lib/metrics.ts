import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';
import { config } from './config.js';

// Create a custom registry
export const registry = new Registry();

// Set default labels
registry.setDefaultLabels({
  service: 'api',
  env: config.nodeEnv,
});

// Collect default Node.js metrics (CPU, memory, event loop, etc.)
collectDefaultMetrics({ register: registry });

// ============================================
// HTTP Request Metrics
// ============================================

export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [registry],
});

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
});

export const httpRequestsInFlight = new Gauge({
  name: 'http_requests_in_flight',
  help: 'Number of HTTP requests currently being processed',
  registers: [registry],
});

// ============================================
// Database Metrics
// ============================================

export const dbQueryTotal = new Counter({
  name: 'db_queries_total',
  help: 'Total number of database queries',
  labelNames: ['operation', 'table', 'status'],
  registers: [registry],
});

export const dbQueryDuration = new Histogram({
  name: 'db_query_duration_seconds',
  help: 'Database query duration in seconds',
  labelNames: ['operation', 'table'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [registry],
});

export const dbPoolConnections = new Gauge({
  name: 'db_pool_connections',
  help: 'Number of database pool connections',
  labelNames: ['state'],
  registers: [registry],
});

// ============================================
// Redis Metrics
// ============================================

export const redisOperationsTotal = new Counter({
  name: 'redis_operations_total',
  help: 'Total number of Redis operations',
  labelNames: ['operation', 'status'],
  registers: [registry],
});

export const redisOperationDuration = new Histogram({
  name: 'redis_operation_duration_seconds',
  help: 'Redis operation duration in seconds',
  labelNames: ['operation'],
  buckets: [0.0001, 0.0005, 0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25],
  registers: [registry],
});

// ============================================
// Queue Metrics
// ============================================

export const jobsEnqueued = new Counter({
  name: 'jobs_enqueued_total',
  help: 'Total number of jobs enqueued',
  labelNames: ['job_type'],
  registers: [registry],
});

export const queueLength = new Gauge({
  name: 'queue_length',
  help: 'Current queue length',
  labelNames: ['queue_name'],
  registers: [registry],
});

// ============================================
// Authentication Metrics
// ============================================

export const authOperationsTotal = new Counter({
  name: 'auth_operations_total',
  help: 'Total number of authentication operations',
  labelNames: ['operation', 'status'],
  registers: [registry],
});

// ============================================
// Business Metrics
// ============================================

export const scansTriggered = new Counter({
  name: 'scans_triggered_total',
  help: 'Total number of scans triggered',
  labelNames: ['org_id'],
  registers: [registry],
});

export const awsAccountsConnected = new Gauge({
  name: 'aws_accounts_connected',
  help: 'Number of AWS accounts currently connected',
  registers: [registry],
});

// User & signup metrics
export const userSignupsTotal = new Counter({
  name: 'user_signups_total',
  help: 'Total number of user signups',
  labelNames: ['method'],
  registers: [registry],
});

export const userLoginsTotal = new Counter({
  name: 'user_logins_total',
  help: 'Total number of user logins',
  labelNames: ['method', 'status'],
  registers: [registry],
});

export const emailVerificationsTotal = new Counter({
  name: 'email_verifications_total',
  help: 'Total number of email verification attempts',
  labelNames: ['status'],
  registers: [registry],
});

// Organization metrics
export const orgsCreatedTotal = new Counter({
  name: 'orgs_created_total',
  help: 'Total number of organizations created',
  registers: [registry],
});

// Subscription lifecycle metrics
export const subscriptionEventsTotal = new Counter({
  name: 'subscription_events_total',
  help: 'Total subscription lifecycle events',
  labelNames: ['event'],
  registers: [registry],
});

export const planSwitchesTotal = new Counter({
  name: 'plan_switches_total',
  help: 'Total plan switches between tiers',
  labelNames: ['from_tier', 'to_tier'],
  registers: [registry],
});

// Gauge metrics (DB-polled on scrape)
export const usersTotal = new Gauge({
  name: 'users_total',
  help: 'Total number of registered users',
  registers: [registry],
});

export const orgsByTier = new Gauge({
  name: 'orgs_by_tier',
  help: 'Number of organizations by subscription tier',
  labelNames: ['tier'],
  registers: [registry],
});

export const orgsBySubscriptionStatus = new Gauge({
  name: 'orgs_by_subscription_status',
  help: 'Number of organizations by subscription status',
  labelNames: ['status'],
  registers: [registry],
});

export const orgsWithAwsAccounts = new Gauge({
  name: 'orgs_with_aws_accounts',
  help: 'Number of organizations with at least one AWS account connected',
  registers: [registry],
});

// ============================================
// Error Metrics
// ============================================

export const errorsTotal = new Counter({
  name: 'errors_total',
  help: 'Total number of errors',
  labelNames: ['type', 'route'],
  registers: [registry],
});

// ============================================
// Service Info Metric
// ============================================

export const serviceInfo = new Gauge({
  name: 'service_info',
  help: 'Service information',
  labelNames: ['version', 'node_version', 'env'],
  registers: [registry],
});

// Set service info
serviceInfo.labels({
  version: process.env.npm_package_version || '0.1.0',
  node_version: process.version,
  env: config.nodeEnv,
}).set(1);

// ============================================
// Utility Functions
// ============================================

export async function getMetrics(): Promise<string> {
  return registry.metrics();
}

export function getContentType(): string {
  return registry.contentType;
}

// Track database operation with timing
export function trackDbOperation<T>(
  operation: string,
  table: string,
  fn: () => Promise<T>
): Promise<T> {
  const end = dbQueryDuration.startTimer({ operation, table });
  return fn()
    .then((result) => {
      end();
      dbQueryTotal.inc({ operation, table, status: 'success' });
      return result;
    })
    .catch((error) => {
      end();
      dbQueryTotal.inc({ operation, table, status: 'error' });
      throw error;
    });
}

// Track Redis operation with timing
export function trackRedisOperation<T>(
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  const end = redisOperationDuration.startTimer({ operation });
  return fn()
    .then((result) => {
      end();
      redisOperationsTotal.inc({ operation, status: 'success' });
      return result;
    })
    .catch((error) => {
      end();
      redisOperationsTotal.inc({ operation, status: 'error' });
      throw error;
    });
}
