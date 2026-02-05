/**
 * Notification Delivery Queue Configuration
 *
 * Rate-limited queues for external notification delivery (Email).
 * Uses BullMQ's built-in limiter to respect API rate limits.
 */

// ============================================================================
// Queue Names
// ============================================================================

export const EMAIL_DELIVERY_QUEUE = "email-delivery";
export const EMAIL_DIGEST_QUEUE = "email-digest";

// ============================================================================
// Rate Limits
// ============================================================================

/**
 * Resend rate limit: Depends on plan
 * Free: 100/day, 1/sec
 * Pro: 10/sec
 * Using conservative limit that works for both
 */
export const EMAIL_RATE_LIMIT = {
  max: 5,
  duration: 1000, // 5 per second
};

// ============================================================================
// Job Data Types
// ============================================================================

export interface CriticalAlertEmailData {
  to: string;
  userId: string;
  template: "critical-alert";
  props: {
    packageName: string;
    newVersion: string;
    previousVersion?: string;
    vulnerabilitiesFixed: number;
    changelogSnippet?: string;
  };
}

export interface ReleaseLaunchedEmailData {
  to: string;
  userId: string;
  template: "release-launched";
  props: {
    releaseTitle: string;
    packageName?: string;
    targetVersion: string;
    releasedVersion: string;
    description?: string;
    websiteUrl?: string;
  };
}

export type EmailDeliveryJobData = CriticalAlertEmailData | ReleaseLaunchedEmailData;

export interface EmailDigestJobData {
  /** Period for the digest job - the job processes all users with this period */
  period: "daily" | "weekly";
}

// ============================================================================
// Retry Configuration
// ============================================================================

/**
 * Retry config for external API calls with exponential backoff
 */
export const EXTERNAL_API_RETRY = {
  attempts: 5,
  backoff: {
    type: "exponential" as const,
    delay: 2000, // Start with 2s, then 4s, 8s, 16s, 32s
  },
  removeOnComplete: { count: 500 },
  removeOnFail: { count: 2000 },
};

/**
 * Retry config for digest emails (run less frequently)
 */
export const DIGEST_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: "exponential" as const,
    delay: 5000,
  },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 500 },
};
