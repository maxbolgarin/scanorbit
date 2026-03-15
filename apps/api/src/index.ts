import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { bodyLimit } from 'hono/body-limit';
import routes from './routes/index.js';
import { requireAuth } from './middlewares/auth.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { auditLog } from './middlewares/auditLog.js';
import { metricsMiddleware } from './middlewares/metrics.js';
import { structuredLoggerMiddleware } from './middlewares/structuredLogger.js';
import { requestIdMiddleware } from './middlewares/requestId.js';
import { config } from './lib/config.js';
import { logger } from './lib/logger.js';
import { getMetrics, getContentType, dbPoolConnections, queueLength, usersTotal, orgsByTier, orgsBySubscriptionStatus, orgsWithAwsAccounts } from './lib/metrics.js';
import { pool } from './lib/db.js';
import { redis } from './lib/redis.js';
import { startSubscriberCron } from './services/subscriberCronService.js';
import { startDripScheduler } from './services/dripSchedulerService.js';
import type { Variables } from './types/index.js';

const app = new Hono<{ Variables: Variables }>();

// Request body size limit (1MB) - prevents large payload DoS attacks
app.use('*', bodyLimit({ maxSize: 1024 * 1024 }));

// Security headers middleware - prevents XSS, clickjacking, MIME sniffing
app.use(
  '*',
  secureHeaders({
    // Strict Transport Security - force HTTPS
    strictTransportSecurity: 'max-age=31536000; includeSubDomains',
    // Prevent clickjacking
    xFrameOptions: 'DENY',
    // Prevent MIME type sniffing
    xContentTypeOptions: 'nosniff',
    // Referrer policy for privacy
    referrerPolicy: 'strict-origin-when-cross-origin',
    // Cross-Origin policies
    crossOriginOpenerPolicy: 'same-origin',
    crossOriginResourcePolicy: 'same-site',
    // Content Security Policy
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      fontSrc: ["'self'"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  })
);

// CORS middleware
app.use(
  cors({
    origin: config.frontendUrl,
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'x-request-id', 'x-trace-id', 'x-span-id'],
    exposeHeaders: ['Set-Cookie', 'x-request-id', 'x-trace-id'],
    maxAge: 86400,
  })
);

// Request ID and trace ID middleware (must be before structuredLogger)
app.use(requestIdMiddleware);

app.use(structuredLoggerMiddleware);
app.use(metricsMiddleware);

// GDPR Compliance: Audit logging for all API requests
// Note: Routes are mounted at root (e.g., /auth, /orgs), not under /api
app.use('/*', auditLog);

// Liveness probe — always returns 200 if the process is running
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: config.nodeEnv,
  });
});

// Readiness probe — checks DB and Redis connectivity
app.get('/health/ready', async (c) => {
  try {
    await pool.query('SELECT 1');
    await redis.ping();
    return c.json({ status: 'ok' });
  } catch {
    return c.json({ status: 'error' }, 503);
  }
});

// Metrics endpoint (Prometheus format) — internal only, blocked by Caddy in production
app.get('/metrics', async (c) => {
  try {
    // Update pool metrics
    dbPoolConnections.labels({ state: 'total' }).set(pool.totalCount);
    dbPoolConnections.labels({ state: 'idle' }).set(pool.idleCount);
    dbPoolConnections.labels({ state: 'waiting' }).set(pool.waitingCount);

    // Update queue metrics
    const queues = [
      'jobs:scan_account',
      'jobs:analyze_orphans',
      'jobs:analyze_ssl',
      'jobs:analyze_residency',
      'jobs:analyze_security',
      'jobs:analyze_cost',
      'jobs:analyze_tagging',
      'jobs:analyze_iam',
    ];

    for (const queue of queues) {
      const len = await redis.llen(queue);
      queueLength.labels({ queue_name: queue.replace('jobs:', '') }).set(len);
    }

    // Update business analytics gauges
    const [userCountResult, tierResults, statusResults, orgsWithAwsResult] = await Promise.all([
      pool.query('SELECT count(*) AS cnt FROM users'),
      pool.query('SELECT tier, count(*) AS cnt FROM orgs GROUP BY tier'),
      pool.query('SELECT subscription_status, count(*) AS cnt FROM orgs GROUP BY subscription_status'),
      pool.query('SELECT count(DISTINCT org_id) AS cnt FROM aws_accounts'),
    ]);

    usersTotal.set(parseInt(userCountResult.rows[0].cnt));

    orgsByTier.reset();
    for (const row of tierResults.rows) {
      orgsByTier.labels({ tier: row.tier || 'free' }).set(parseInt(row.cnt));
    }

    orgsBySubscriptionStatus.reset();
    for (const row of statusResults.rows) {
      orgsBySubscriptionStatus.labels({ status: row.subscription_status || 'none' }).set(parseInt(row.cnt));
    }

    orgsWithAwsAccounts.set(parseInt(orgsWithAwsResult.rows[0].cnt));

    const metrics = await getMetrics();
    return c.text(metrics, 200, {
      'Content-Type': getContentType(),
    });
  } catch (error) {
    logger.error('Failed to get metrics', error);
    return c.text('Failed to collect metrics', 500);
  }
});

// Status endpoint (JSON format for CLI/debugging) — requires authentication
app.get('/status', requireAuth, async (c) => {
  try {
    // Get queue lengths
    const queueLengths: Record<string, number> = {};
    const queues = [
      'scan_account',
      'analyze_orphans',
      'analyze_ssl',
      'analyze_residency',
      'analyze_security',
      'analyze_cost',
      'analyze_tagging',
      'analyze_iam',
    ];

    for (const queue of queues) {
      queueLengths[queue] = await redis.llen(`jobs:${queue}`);
    }

    // Test database connection
    let dbStatus = 'ok';
    try {
      await pool.query('SELECT 1');
    } catch {
      dbStatus = 'error';
    }

    // Test Redis connection
    let redisStatus = 'ok';
    try {
      await redis.ping();
    } catch {
      redisStatus = 'error';
    }

    return c.json({
      service: 'api',
      status: 'ok',
      timestamp: new Date().toISOString(),
      env: config.nodeEnv,
      version: process.env.npm_package_version || '0.1.0',
      node_version: process.version,
      uptime_seconds: process.uptime(),
      memory: {
        rss_mb: Math.round(process.memoryUsage().rss / 1024 / 1024),
        heap_used_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        heap_total_mb: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      },
      database: {
        status: dbStatus,
        pool: {
          total: pool.totalCount,
          idle: pool.idleCount,
          waiting: pool.waitingCount,
        },
      },
      redis: {
        status: redisStatus,
      },
      queues: queueLengths,
    });
  } catch (error) {
    logger.error('Failed to get status', error);
    return c.json({ status: 'error', message: 'Failed to get status' }, 500);
  }
});

// API routes
app.route('/', routes);

// Global error handler
app.onError(errorHandler);

// 404 handler — generic message to avoid leaking route structure
app.notFound((c) => {
  return c.json({ error: 'Not found' }, 404);
});

// Start server
const port = config.port;

logger.info('starting ScanOrbit API server', {
  env: config.nodeEnv,
  port,
});

// Helper function to handle port in use errors
function handlePortError(err: NodeJS.ErrnoException, port: number): never {
  if (err.code === 'EADDRINUSE') {
    logger.fatal('port already in use', err, { port });
    process.exit(1);
  }
  throw err;
}

// Handle uncaught exceptions (fallback)
process.on('uncaughtException', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    handlePortError(err, port);
  } else {
    logger.fatal('uncaught exception', err);
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  if (reason && typeof reason === 'object' && 'code' in reason) {
    const err = reason as NodeJS.ErrnoException;
    if (err.code === 'EADDRINUSE') {
      handlePortError(err, port);
    }
  }
  logger.fatal('unhandled rejection', reason as Error, { promise: String(promise) });
  process.exit(1);
});

try {
  const server = serve(
    {
      fetch: app.fetch,
      port,
    },
    (info) => {
      logger.info('server started', {
        port: info.port,
        url: `http://localhost:${info.port}`,
      });

      // Start subscriber lifecycle polling and drip scheduler
      startSubscriberCron();
      startDripScheduler();
    }
  );

  // Handle server errors if server instance supports it
  if (server && typeof server === 'object' && 'on' in server) {
    (server as { on: (event: string, handler: (err: NodeJS.ErrnoException) => void) => void }).on('error', (err: NodeJS.ErrnoException) => {
      handlePortError(err, port);
    });
  }

  // Graceful shutdown handler
  const gracefulShutdown = (signal: string) => {
    logger.info(`${signal} received, starting graceful shutdown`);

    // Force exit if graceful shutdown takes too long (unref so it doesn't keep process alive)
    const forceTimer = setTimeout(() => {
      logger.error('Graceful shutdown timed out, forcing exit');
      process.exit(1);
    }, 30_000);
    forceTimer.unref();

    // Stop accepting new connections and drain in-flight requests
    if (server && typeof server === 'object' && 'close' in server) {
      (server as { close: (cb?: () => void) => void }).close(() => {
        logger.info('HTTP server closed, cleaning up connections');

        // Race cleanup against a timeout to prevent hanging on pool.end()/redis.quit()
        const cleanup = Promise.allSettled([pool.end(), redis.quit()]).then((results) => {
          const labels = ['database pool', 'redis'];
          results.forEach((result, i) => {
            if (result.status === 'rejected') {
              logger.error(`Failed to close ${labels[i]}`, result.reason as Error);
            }
          });
        });
        const timeout = new Promise<void>((resolve) => {
          const t = setTimeout(() => {
            logger.warn('Connection cleanup timed out after 5s');
            resolve();
          }, 5_000);
          t.unref();
        });

        Promise.race([cleanup, timeout])
          .finally(() => {
            process.exit(0);
          });
      });
    }
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
} catch (err) {
  const error = err as NodeJS.ErrnoException;
  if (error.code === 'EADDRINUSE') {
    handlePortError(error, port);
  } else {
    logger.fatal('failed to start server', error);
    process.exit(1);
  }
}

export default app;
