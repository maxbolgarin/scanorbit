import { readFileSync } from 'fs';
import pg from 'pg';
import { config } from './config.js';
import { logger } from './logger.js';

const { Pool } = pg;

const useSSL = config.databaseUrl.includes('sslmode=require');

const caCert = process.env.DB_CA_CERT
  ? readFileSync(process.env.DB_CA_CERT)
  : undefined;

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ...(useSSL && {
    ssl: {
      rejectUnauthorized: true,
      ca: caCert,
      minVersion: 'TLSv1.3',
    },
  }),
});

pool.on('error', (err: Error & { code?: string }) => {
  if (err.code === '57P01') {
    logger.warn('Database connection terminated by server, pool will reconnect');
    return;
  }
  logger.error('Unexpected error on idle client', err);
});
