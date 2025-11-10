import { createClient, RedisClientType } from 'redis';

let redisClient: RedisClientType | null = null;

// In-memory fallback for development
const memoryCache = new Map<string, { value: string; expiry: number }>();

export async function getRedisClient(): Promise<RedisClientType | null> {
  if (process.env.NODE_ENV === 'development' && !process.env.REDIS_URL) {
    // Use in-memory cache in development
    return null;
  }

  if (redisClient) {
    return redisClient;
  }

  try {
    redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            return new Error('Redis max retries exceeded');
          }
          return Math.min(retries * 50, 500);
        },
      },
    });

    redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    await redisClient.connect();
    console.log('Redis connected successfully');

    return redisClient;
  } catch (error) {
    console.error('Failed to connect to Redis:', error);
    return null;
  }
}

// Cache helper functions
export async function cacheGet<T>(key: string): Promise<T | null> {
  const client = await getRedisClient();

  if (client) {
    try {
      const value = await client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Redis GET error:', error);
    }
  }

  // Fallback to memory cache
  const cached = memoryCache.get(key);
  if (cached && cached.expiry > Date.now()) {
    return JSON.parse(cached.value);
  }
  return null;
}

export async function cacheSet(
  key: string,
  value: any,
  ttlSeconds: number = 300
): Promise<void> {
  const client = await getRedisClient();
  const stringValue = JSON.stringify(value);

  if (client) {
    try {
      await client.setEx(key, ttlSeconds, stringValue);
      return;
    } catch (error) {
      console.error('Redis SET error:', error);
    }
  }

  // Fallback to memory cache
  memoryCache.set(key, {
    value: stringValue,
    expiry: Date.now() + ttlSeconds * 1000,
  });
}

export async function cacheDelete(key: string): Promise<void> {
  const client = await getRedisClient();

  if (client) {
    try {
      await client.del(key);
      return;
    } catch (error) {
      console.error('Redis DEL error:', error);
    }
  }

  memoryCache.delete(key);
}

export async function cacheInvalidatePattern(pattern: string): Promise<void> {
  const client = await getRedisClient();

  if (client) {
    try {
      const keys = await client.keys(pattern);
      if (keys.length > 0) {
        await client.del(keys);
      }
      return;
    } catch (error) {
      console.error('Redis pattern invalidation error:', error);
    }
  }

  // For memory cache, iterate and delete matching keys
  for (const key of memoryCache.keys()) {
    if (new RegExp(pattern.replace('*', '.*')).test(key)) {
      memoryCache.delete(key);
    }
  }
}

// Cleanup memory cache periodically
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of memoryCache.entries()) {
      if (value.expiry <= now) {
        memoryCache.delete(key);
      }
    }
  }, 60000); // Every minute
}

// Cache key generators
export const CacheKeys = {
  job: (jobId: string) => `job:${jobId}`,
  jobs: (companyId: string, status?: string) =>
    `jobs:${companyId}${status ? `:${status}` : ''}`,
  candidate: (candidateId: string) => `candidate:${candidateId}`,
  candidates: (jobId: string) => `candidates:${jobId}`,
  decision: (decisionId: string) => `decision:${decisionId}`,
  decisions: (jobId: string) => `decisions:${jobId}`,
  template: (templateId: string) => `template:${templateId}`,
  templates: (companyId: string) => `templates:${companyId}`,
  analytics: (companyId: string, period: string) => `analytics:${companyId}:${period}`,
  user: (userId: string) => `user:${userId}`,
};
