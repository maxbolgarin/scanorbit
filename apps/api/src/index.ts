import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import routes from './routes/index.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { auditLog } from './middlewares/auditLog.js';
import { config } from './lib/config.js';
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
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['Set-Cookie'],
    maxAge: 86400,
  })
);

app.use(logger());

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

console.log(`Starting ScanOrbit API server...`);
console.log(`Environment: ${config.nodeEnv}`);
console.log(`Port: ${port}`);

// Helper function to handle port in use errors
function handlePortError(err: NodeJS.ErrnoException, port: number): never {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Error: Port ${port} is already in use.`);
    console.error(`\nPlease either:`);
    console.error(`  1. Stop the process using port ${port}`);
    console.error(`  2. Set a different port via PORT environment variable`);
    console.error(`  3. Find and kill the process: lsof -ti:${port} | xargs kill -9\n`);
    process.exit(1);
  }
  throw err;
}

// Handle uncaught exceptions (fallback)
process.on('uncaughtException', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    handlePortError(err, port);
  } else {
    console.error('\n❌ Uncaught exception:', err);
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
  console.error('\n❌ Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

try {
  const server = serve(
    {
      fetch: app.fetch,
      port,
    },
    (info) => {
      console.log(`Server is running on http://localhost:${info.port}`);
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
    console.error('\n❌ Failed to start server:', error);
    process.exit(1);
  }
}

export default app;
