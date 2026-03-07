import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import routes from './routes/index.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { auditLog } from './middlewares/auditLog.js';
import { metricsMiddleware } from './middlewares/metrics.js';
import { structuredLoggerMiddleware } from './middlewares/structuredLogger.js';
import { requestIdMiddleware } from './middlewares/requestId.js';
import { config } from './lib/config.js';
import { logger } from './lib/logger.js';
import { getMetrics, getContentType, dbPoolConnections, queueLength } from './lib/metrics.js';
import { pool } from './lib/db.js';
import { redis } from './lib/redis.js';
import { startListmonkCron } from './services/listmonkCronService.js';
import type { Variables } from './types/index.js';

const app = new Hono<{ Variables: Variables }>();

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
    crossOriginResourcePolicy: 'same-origin',
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
    allowHeaders: ['Content-Type', 'Authorization', 'x-request-id', 'x-trace-id', 'x-span-id'],
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

// Health check endpoint
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: config.nodeEnv,
  });
});

// Metrics endpoint (Prometheus format)
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

    const metrics = await getMetrics();
    return c.text(metrics, 200, {
      'Content-Type': getContentType(),
    });
  } catch (error) {
    logger.error('Failed to get metrics', error);
    return c.text('Failed to collect metrics', 500);
  }
});

// Status endpoint (JSON format for CLI/debugging)
app.get('/status', async (c) => {
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

// 404 handler
app.notFound((c) => {
  return c.json(
    {
      error: 'NotFound',
      message: `Route ${c.req.method} ${c.req.path} not found`,
    },
    404
  );
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

      // Start Listmonk campaign list polling after server is ready
      startListmonkCron();
    }
  );

  // Handle server errors if server instance supports it
  if (server && typeof server === 'object' && 'on' in server) {
    (server as { on: (event: string, handler: (err: NodeJS.ErrnoException) => void) => void }).on('error', (err: NodeJS.ErrnoException) => {
      handlePortError(err, port);
    });
  }
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
