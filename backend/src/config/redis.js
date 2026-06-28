import IORedis from 'ioredis';
import { env } from './env.js';
import { logger } from './logger.js';

// Koneksi untuk BullMQ harus pakai maxRetriesPerRequest: null
export function createRedisConnection(extra = {}) {
  return new IORedis({
    host: env.redis.host,
    port: env.redis.port,
    password: env.redis.password,
    db: env.redis.db,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    ...extra,
  });
}

// Koneksi umum (cache, rate-limit store)
export const redis = new IORedis({
  host: env.redis.host,
  port: env.redis.port,
  password: env.redis.password,
  db: env.redis.db,
  lazyConnect: false,
});

redis.on('error', (err) => logger.error({ err }, 'Redis error'));
redis.on('connect', () => logger.info('Redis connected'));

export default redis;
