import { readFileSync } from 'fs';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { config } from './config.js';
import * as schema from '../db/schema.js';

const { Pool } = pg;

// Check if SSL is required (sslmode in connection string)
const useSSL = config.databaseUrl.includes('sslmode=require');

// Load CA certificate if specified (for self-signed cert validation)
const caCert = process.env.DB_CA_CERT
  ? readFileSync(process.env.DB_CA_CERT)
  : undefined;

const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  ...(useSSL && {
    ssl: {
      rejectUnauthorized: true,
      ca: caCert,
    },
  }),
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

export const db = drizzle(pool, { schema });

export { pool };
