/**
 * Email Delivery Worker
 *
 * Processes immediate email notification jobs (critical alerts).
 */

import { createWorker, type Job } from "@packrun/queue";
import {
  EMAIL_DELIVERY_QUEUE,
  EMAIL_RATE_LIMIT,
  type EmailDeliveryJobData,
} from "@packrun/queue/delivery";
import { sendEmail, CriticalAlert, generateUnsubscribeToken } from "@packrun/email";
import React from "react";

/**
 * Process email delivery job
 */
async function processEmailDelivery(job: Job<EmailDeliveryJobData>): Promise<void> {
  const { to, userId, template, props } = job.data;

  if (template !== "critical-alert") {
    console.log(`[Email] Unknown template: ${template}, skipping`);
    return;
  }

  // Generate unsubscribe URL
  const unsubscribeToken = generateUnsubscribeToken(userId);
  const unsubscribeUrl = `https://packrun.dev/api/unsubscribe?token=${unsubscribeToken}`;

  // Create React element for the email
  const emailElement = React.createElement(CriticalAlert, {
    packageName: props.packageName,
    newVersion: props.newVersion,
    previousVersion: props.previousVersion,
    vulnerabilitiesFixed: props.vulnerabilitiesFixed,
    changelogSnippet: props.changelogSnippet,
    unsubscribeUrl,
  });

  // Send email
  const result = await sendEmail({
    to,
    subject: `🔒 Security update: ${props.packageName}@${props.newVersion}`,
    react: emailElement,
    userId,
  });

  if (result) {
    console.log(
      `[Email] Sent critical alert for ${props.packageName}@${props.newVersion} to ${to}`,
    );
  } else {
    console.log(`[Email] Skipped (not configured) for ${props.packageName}@${props.newVersion}`);
  }
}

/**
 * Create and start the email delivery worker
 */
export function createEmailDeliveryWorker() {
  return createWorker<EmailDeliveryJobData>(EMAIL_DELIVERY_QUEUE, processEmailDelivery, {
    concurrency: 10,
    limiter: EMAIL_RATE_LIMIT,
  });
}
