/**
 * Email Digest Scheduler
 *
 * Schedules daily and weekly digest jobs using BullMQ's repeatable jobs.
 */

import { getConnection } from "@packrun/queue";
import {
  DIGEST_JOB_OPTIONS,
  EMAIL_DIGEST_QUEUE,
  type EmailDigestJobData,
} from "@packrun/queue/delivery";
import { Queue } from "bullmq";

let digestQueue: Queue<EmailDigestJobData> | null = null;

/**
 * Initialize the digest queue and schedule jobs
 */
export async function initializeDigestScheduler() {
  const connection = getConnection();

  digestQueue = new Queue<EmailDigestJobData>(EMAIL_DIGEST_QUEUE, {
    connection,
  });

  // Remove any existing repeatable jobs to avoid duplicates
  const existing = await digestQueue.getRepeatableJobs();
  for (const job of existing) {
    await digestQueue.removeRepeatableByKey(job.key);
  }

  // Schedule daily digest at 9:00 AM UTC
  await digestQueue.add(
    "daily-digest",
    { period: "daily" },
    {
      ...DIGEST_JOB_OPTIONS,
      repeat: {
        pattern: "0 9 * * *", // 9 AM UTC every day
      },
    },
  );

  // Schedule weekly digest at 9:00 AM UTC on Mondays
  await digestQueue.add(
    "weekly-digest",
    { period: "weekly" },
    {
      ...DIGEST_JOB_OPTIONS,
      repeat: {
        pattern: "0 9 * * 1", // 9 AM UTC on Monday
      },
    },
  );

  console.log("[Digest Scheduler] Scheduled daily digest at 9:00 AM UTC");
  console.log("[Digest Scheduler] Scheduled weekly digest at 9:00 AM UTC on Mondays");

  return digestQueue;
}

/**
 * Get the digest queue instance
 */
export function getDigestQueue() {
  return digestQueue;
}
