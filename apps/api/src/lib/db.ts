import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { config } from './config.js';
import * as schema from '../db/schema.js';

const { Pool } = pg;

// Check if SSL is required (sslmode in connection string)
const useSSL = config.databaseUrl.includes('sslmode=require');

// In production, verify TLS certificates unless explicitly disabled via env var
const rejectUnauthorized = config.nodeEnv === 'production'
  ? process.env.DB_TLS_REJECT_UNAUTHORIZED !== 'false'
  : false; // Allow self-signed in development

const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  ...(useSSL && {
    ssl: {
      rejectUnauthorized,
    },
  }),
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

export const db = drizzle(pool, { schema });

export { pool };
