/**
 * @v1/queue - Generic BullMQ queue infrastructure
 *
 * Provides connection management and utilities for creating queues and workers.
 * Job types and queue names are defined by the consuming apps.
 */

import { type ConnectionOptions, type Job, type JobsOptions, Queue, Worker } from "bullmq";

// ============================================================================
// Connection
// ============================================================================

/**
 * Parse Redis URL to connection options for BullMQ
 */
export function parseRedisUrl(url?: string): ConnectionOptions {
  if (url) {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: Number(parsed.port) || 6379,
      password: parsed.password || undefined,
    };
  }

  return {
    host: process.env.REDIS_HOST || "localhost",
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
  };
}

/**
 * Get Redis connection from environment
 */
export function getConnection(): ConnectionOptions {
  return parseRedisUrl(process.env.REDIS_URL);
}

/**
 * Get Redis connection info for logging
 */
export function getConnectionInfo(): { host: string; port: number } {
  const conn = parseRedisUrl(process.env.REDIS_URL);
  return {
    host: (conn as { host?: string }).host || "localhost",
    port: (conn as { port?: number }).port || 6379,
  };
}

// ============================================================================
// Queue Factory
// ============================================================================

export interface QueueOptions<T = unknown> {
  name: string;
  connection?: ConnectionOptions;
  defaultJobOptions?: JobsOptions;
}

const queues = new Map<string, Queue>();

/**
 * Create or get a queue instance
 */
export function getQueue<T = unknown>(options: QueueOptions<T>): Queue<T> {
  const existing = queues.get(options.name);
  if (existing) {
    return existing as Queue<T>;
  }

  const queue = new Queue<T>(options.name, {
    connection: options.connection || getConnection(),
    defaultJobOptions: options.defaultJobOptions,
  });

  queue.on("error", (error: Error) => {
    console.error(`[Queue:${options.name}] Error:`, error.message);
  });

  queues.set(options.name, queue);
  return queue;
}

/**
 * Close all queue connections
 */
export async function closeAllQueues(): Promise<void> {
  const promises = Array.from(queues.values()).map((q) => q.close());
  await Promise.all(promises);
  queues.clear();
}

/**
 * Close a specific queue
 */
export async function closeQueue(name: string): Promise<void> {
  const queue = queues.get(name);
  if (queue) {
    await queue.close();
    queues.delete(name);
  }
}

// ============================================================================
// Worker Factory
// ============================================================================

export interface WorkerOptions {
  connection?: ConnectionOptions;
  concurrency?: number;
  limiter?: {
    max: number;
    duration: number;
  };
}

/**
 * Create a worker for processing jobs
 */
export function createWorker<T = unknown>(
  queueName: string,
  processor: (job: Job<T>) => Promise<void>,
  options?: WorkerOptions,
): Worker<T> {
  return new Worker<T>(queueName, processor, {
    connection: options?.connection || getConnection(),
    concurrency: options?.concurrency || 10,
    limiter: options?.limiter,
  });
}

// ============================================================================
// Job Options Types
// ============================================================================

export interface AddJobOptions {
  jobId?: string;
  priority?: number;
  delay?: number;
  attempts?: number;
  backoff?: {
    type: "exponential" | "fixed";
    delay: number;
  };
}

// ============================================================================
// Stats
// ============================================================================

export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

/**
 * Get statistics for a queue
 */
export async function getQueueStats(queue: Queue): Promise<QueueStats> {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ]);

  return { waiting, active, completed, failed, delayed };
}

// ============================================================================
// Default Job Options Presets
// ============================================================================

/**
 * Standard retry options for sync jobs
 */
export const JOB_PRESETS = {
  /** Fast jobs with quick retries */
  fast: {
    attempts: 3,
    backoff: { type: "exponential" as const, delay: 1000 },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
  /** Standard jobs with moderate retries */
  standard: {
    attempts: 3,
    backoff: { type: "exponential" as const, delay: 2000 },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
  /** Bulk jobs with longer retries */
  bulk: {
    attempts: 3,
    backoff: { type: "exponential" as const, delay: 5000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 1000 },
  },
} as const;

// Re-export BullMQ types
export { Queue, Worker, type Job, type ConnectionOptions, type JobsOptions };
