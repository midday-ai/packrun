/**
 * Slack Delivery Worker
 *
 * Processes Slack notification jobs with rate limiting.
 */

import { createWorker, type Job } from "@packrun/queue";
import {
  SLACK_DELIVERY_QUEUE,
  SLACK_RATE_LIMIT,
  type SlackDeliveryJobData,
} from "@packrun/queue/delivery";
import { db } from "@packrun/db/client";

interface SlackConfig {
  accessToken: string;
  channelId: string;
  channelName: string;
}

/**
 * Format notification message for Slack
 */
function formatSlackMessage(notification: SlackDeliveryJobData["notification"]): {
  text: string;
  blocks: object[];
} {
  const { packageName, newVersion, previousVersion, severity, isSecurityUpdate, isBreakingChange } =
    notification;

  const versionText = previousVersion ? `${previousVersion} → ${newVersion}` : newVersion;
  const packageUrl = `https://packrun.dev/${encodeURIComponent(packageName)}`;

  // Emoji based on severity
  let emoji = "📦";
  if (isSecurityUpdate) emoji = "🔒";
  else if (isBreakingChange) emoji = "⚠️";

  const text = `${emoji} ${packageName} updated to ${newVersion}`;

  const blocks: object[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${emoji} *<${packageUrl}|${packageName}>* updated to \`${versionText}\``,
      },
    },
  ];

  // Add context based on update type
  const contextItems: string[] = [];

  if (isSecurityUpdate && notification.vulnerabilitiesFixed) {
    contextItems.push(`🔐 Fixes ${notification.vulnerabilitiesFixed} vulnerabilities`);
  }
  if (isBreakingChange) {
    contextItems.push("⚠️ Breaking change - check before updating");
  }

  if (contextItems.length > 0) {
    blocks.push({
      type: "context",
      elements: contextItems.map((text) => ({
        type: "mrkdwn",
        text,
      })),
    });
  }

  // Add changelog snippet if available
  if (notification.changelogSnippet) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `> ${notification.changelogSnippet.slice(0, 200)}${notification.changelogSnippet.length > 200 ? "..." : ""}`,
      },
    });
  }

  // Add action button
  blocks.push({
    type: "actions",
    elements: [
      {
        type: "button",
        text: {
          type: "plain_text",
          text: "View on packrun.dev",
        },
        url: packageUrl,
      },
    ],
  });

  return { text, blocks };
}

/**
 * Send message to Slack
 */
async function sendSlackMessage(config: SlackConfig, message: { text: string; blocks: object[] }) {
  const response = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.accessToken}`,
    },
    body: JSON.stringify({
      channel: config.channelId,
      text: message.text,
      blocks: message.blocks,
      unfurl_links: false,
      unfurl_media: false,
    }),
  });

  const data = await response.json();

  if (!data.ok) {
    throw new Error(`Slack API error: ${data.error}`);
  }

  return data;
}

/**
 * Process Slack delivery job
 */
async function processSlackDelivery(job: Job<SlackDeliveryJobData>): Promise<void> {
  const { integrationId, notification } = job.data;

  if (!db) {
    throw new Error("Database not available");
  }

  // Fetch integration config
  const integrations = await db.execute<{
    id: string;
    config: unknown;
    enabled: boolean;
  }>`
    SELECT id, config, enabled FROM integration_connection
    WHERE id = ${integrationId}
  `;

  if (integrations.length === 0) {
    console.log(`[Slack] Integration ${integrationId} not found, skipping`);
    return;
  }

  const integration = integrations[0]!;

  if (!integration.enabled) {
    console.log(`[Slack] Integration ${integrationId} is disabled, skipping`);
    return;
  }

  const config = integration.config as SlackConfig;

  if (!config.accessToken || !config.channelId) {
    throw new Error("Invalid Slack config: missing accessToken or channelId");
  }

  // Format and send message
  const message = formatSlackMessage(notification);
  await sendSlackMessage(config, message);

  console.log(
    `[Slack] Sent notification for ${notification.packageName}@${notification.newVersion}`,
  );
}

/**
 * Create and start the Slack delivery worker
 */
export function createSlackDeliveryWorker() {
  return createWorker<SlackDeliveryJobData>(SLACK_DELIVERY_QUEUE, processSlackDelivery, {
    concurrency: 5,
    limiter: SLACK_RATE_LIMIT,
  });
}
