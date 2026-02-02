/**
 * Redis Connection
 *
 * Shared Redis connection configuration for BullMQ queues.
 */

export interface RedisConnection {
  host: string;
  port: number;
  password?: string;
}

function getRedisConnection(): RedisConnection {
  const redisUrl = process.env.REDIS_URL;

  if (redisUrl) {
    // Parse URL format: redis://host:port or redis://:password@host:port
    const url = new URL(redisUrl);
    return {
      host: url.hostname,
      port: Number(url.port) || 6379,
      password: url.password || undefined,
    };
  }

  // Fallback to individual env vars
  return {
    host: process.env.REDIS_HOST || "localhost",
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
  };
}

export const connection = getRedisConnection();
