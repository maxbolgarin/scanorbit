import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import routes from './routes/index.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { config } from './lib/config.js';
import type { Variables } from './types/index.js';

const app = new Hono<{ Variables: Variables }>();

// Global middleware
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

serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  }
);

export default app;
