import Redis from 'ioredis';
import { env } from './env.js';

let isRedisConnected = false;
let redisWarningLogged = false;

export const redisConnectionOptions = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,
  lazyConnect: true,
  retryStrategy(times) {
    if (times > 3) {
      if (!redisWarningLogged) {
        console.warn('⚠️  Redis server is offline. Background tasks will process directly via async runner.');
        redisWarningLogged = true;
      }
      return null; // Stop retrying to avoid spamming the console
    }
    return 1000;
  },
};

export const redisClient = env.REDIS_URL
  ? new Redis(env.REDIS_URL, { maxRetriesPerRequest: null, lazyConnect: true })
  : new Redis(redisConnectionOptions);

// Attempt connection safely in the background
redisClient.connect().then(() => {
  isRedisConnected = true;
  console.log('📦 Redis client connected successfully');
}).catch(() => {
  if (!redisWarningLogged) {
    console.warn('⚠️  Redis offline: Using direct async processing fallback');
    redisWarningLogged = true;
  }
});

redisClient.on('error', (err) => {
  isRedisConnected = false;
  if (!redisWarningLogged) {
    console.warn('⚠️  Redis connection notice:', err.message);
    redisWarningLogged = true;
  }
});

/**
 * Check Redis connection health
 */
export const checkRedisHealth = async () => {
  if (!isRedisConnected) {
    return { healthy: true, mode: 'Direct Execution Mode (Redis offline)' };
  }
  try {
    const ping = await redisClient.ping();
    return { healthy: ping === 'PONG', mode: 'Redis 7 (Live)' };
  } catch (error) {
    return { healthy: true, mode: 'Direct Execution Mode (Redis offline)' };
  }
};
