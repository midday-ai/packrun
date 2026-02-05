/**
 * Email Delivery Worker
 *
 * Processes immediate email notification jobs (critical alerts, release announcements).
 */

import {
  CriticalAlert,
  generateUnsubscribeToken,
  ReleaseLaunched,
  sendEmail,
} from "@packrun/email";
import { createWorker, type Job } from "@packrun/queue";
import {
  type CriticalAlertEmailData,
  EMAIL_DELIVERY_QUEUE,
  EMAIL_RATE_LIMIT,
  type EmailDeliveryJobData,
  type ReleaseLaunchedEmailData,
} from "@packrun/queue/delivery";
import React from "react";

/**
 * Process critical alert email
 */
async function processCriticalAlert(
  to: string,
  userId: string,
  props: CriticalAlertEmailData["props"],
): Promise<void> {
  // Generate unsubscribe URL
  const unsubscribeToken = generateUnsubscribeToken(userId);
  const unsubscribeUrl = `https://api.packrun.dev/v1/unsubscribe?token=${unsubscribeToken}`;

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
 * Process release launched email
 */
async function processReleaseLaunched(
  to: string,
  userId: string,
  props: ReleaseLaunchedEmailData["props"],
): Promise<void> {
  // Generate unsubscribe URL
  const unsubscribeToken = generateUnsubscribeToken(userId);
  const unsubscribeUrl = `https://api.packrun.dev/v1/unsubscribe?token=${unsubscribeToken}`;

  // Create React element for the email
  const emailElement = React.createElement(ReleaseLaunched, {
    releaseTitle: props.releaseTitle,
    packageName: props.packageName,
    releasedVersion: props.releasedVersion,
    description: props.description,
    websiteUrl: props.websiteUrl,
    unsubscribeUrl,
  });

  // Send email with exciting subject line
  const packagePart = props.packageName ? `${props.packageName} ` : "";
  const subject = `🚀 ${props.releaseTitle} is here! ${packagePart}v${props.releasedVersion} just shipped`;

  const result = await sendEmail({
    to,
    subject,
    react: emailElement,
    userId,
  });

  if (result) {
    console.log(`[Email] Sent release notification for ${props.releaseTitle} to ${to}`);
  } else {
    console.log(`[Email] Skipped (not configured) for ${props.releaseTitle}`);
  }
}

/**
 * Process email delivery job
 */
async function processEmailDelivery(job: Job<EmailDeliveryJobData>): Promise<void> {
  const { to, userId, template, props } = job.data;

  switch (template) {
    case "critical-alert":
      await processCriticalAlert(to, userId, props as CriticalAlertEmailData["props"]);
      break;
    case "release-launched":
      await processReleaseLaunched(to, userId, props as ReleaseLaunchedEmailData["props"]);
      break;
    default:
      console.log(`[Email] Unknown template: ${template}, skipping`);
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
