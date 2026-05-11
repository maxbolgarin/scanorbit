import { readFileSync } from 'fs';
import Redis from 'ioredis';
import { config } from './config.js';
import { logger } from './logger.js';

const isTLS = config.redisUrl.startsWith('rediss://');

const caCert = process.env.REDIS_CA_CERT
  ? readFileSync(process.env.REDIS_CA_CERT)
  : undefined;

const redisOptions = {
  maxRetriesPerRequest: 3,
  retryStrategy(times: number) {
    return Math.min(times * 50, 2000);
  },
  ...(isTLS && {
    tls: {
      rejectUnauthorized: true,
      ca: caCert,
      minVersion: 'TLSv1.3' as const,
    },
  }),
};

// General-purpose Redis client (for SET/GET/dedup keys)
export const redis = new Redis(config.redisUrl, redisOptions);

redis.on('error', (err) => logger.error('Redis connection error', err));
redis.on('connect', () => logger.info('Connected to Redis'));

// Dedicated subscriber client (ioredis requires a separate connection for subscribe mode)
export const redisSub = new Redis(config.redisUrl, redisOptions);

redisSub.on('error', (err) => logger.error('Redis sub connection error', err));
redisSub.on('connect', () => logger.info('Connected to Redis (subscriber)'));
