/**
 * Email Digest Processor
 *
 * Sends daily/weekly digest emails to users who have enabled them.
 * Groups notifications by severity and includes unread updates from the period.
 */

import { sendEmail, Digest, generateUnsubscribeToken, type DigestUpdate } from "@packrun/email";
import { db } from "@packrun/db/client";
import React from "react";

/**
 * Process digest for a single user
 */
async function processUserDigest(
  userId: string,
  email: string,
  period: "daily" | "weekly",
): Promise<boolean> {
  if (!db) return false;

  // Calculate date range
  const now = new Date();
  const startDate = new Date(now);
  if (period === "daily") {
    startDate.setDate(startDate.getDate() - 1);
  } else {
    startDate.setDate(startDate.getDate() - 7);
  }

  // Fetch unread notifications for this user from the period
  const notifications = await db.execute<{
    package_name: string;
    new_version: string;
    previous_version: string | null;
    severity: string;
    is_security_update: boolean;
    is_breaking_change: boolean;
    changelog_snippet: string | null;
    vulnerabilities_fixed: number | null;
    created_at: Date;
  }>`
    SELECT 
      package_name, new_version, previous_version, severity,
      is_security_update, is_breaking_change, changelog_snippet,
      vulnerabilities_fixed, created_at
    FROM notification
    WHERE user_id = ${userId}
      AND created_at >= ${startDate}
      AND read = false
    ORDER BY 
      CASE severity
        WHEN 'critical' THEN 1
        WHEN 'important' THEN 2
        ELSE 3
      END,
      created_at DESC
    LIMIT 50
  `;

  if (notifications.length === 0) {
    console.log(`[Digest] No notifications for user ${userId}, skipping`);
    return true;
  }

  // Transform to digest format
  const updates: DigestUpdate[] = notifications.map((n) => ({
    packageName: n.package_name,
    newVersion: n.new_version,
    previousVersion: n.previous_version || undefined,
    severity: n.severity as "critical" | "important" | "info",
    isSecurityUpdate: n.is_security_update,
    isBreakingChange: n.is_breaking_change,
    changelogSnippet: n.changelog_snippet || undefined,
    vulnerabilitiesFixed: n.vulnerabilities_fixed || undefined,
  }));

  // Generate unsubscribe URL
  const unsubscribeToken = generateUnsubscribeToken(userId, "digest");
  const unsubscribeUrl = `https://packrun.dev/api/unsubscribe?token=${unsubscribeToken}`;

  // Create and send email
  const emailElement = React.createElement(Digest, {
    updates,
    period,
    unsubscribeUrl,
  });

  const periodText = period === "daily" ? "Daily" : "Weekly";
  const criticalCount = updates.filter((u) => u.severity === "critical").length;
  const subject =
    criticalCount > 0
      ? `🔒 ${periodText} digest: ${criticalCount} security ${criticalCount === 1 ? "update" : "updates"}`
      : `📦 ${periodText} digest: ${updates.length} package ${updates.length === 1 ? "update" : "updates"}`;

  const result = await sendEmail({
    to: email,
    subject,
    react: emailElement,
    userId,
  });

  if (result) {
    console.log(`[Digest] Sent ${period} digest to ${email} (${updates.length} updates)`);
    return true;
  }

  return false;
}

/**
 * Process all digest emails for a given period
 */
export async function processDigests(period: "daily" | "weekly"): Promise<{
  sent: number;
  failed: number;
  skipped: number;
}> {
  if (!db) {
    console.log("[Digest] Database not available");
    return { sent: 0, failed: 0, skipped: 0 };
  }

  console.log(`[Digest] Starting ${period} digest processing`);

  // Find all users with digest enabled for this period
  const users = await db.execute<{
    user_id: string;
    email: string;
  }>`
    SELECT np.user_id, u.email
    FROM notification_preferences np
    JOIN "user" u ON np.user_id = u.id
    WHERE np.email_digest_enabled = true
      AND np.email_digest_frequency = ${period}
  `;

  console.log(`[Digest] Found ${users.length} users with ${period} digest enabled`);

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const user of users) {
    try {
      const success = await processUserDigest(user.user_id, user.email, period);
      if (success) {
        sent++;
      } else {
        skipped++;
      }
    } catch (error) {
      console.error(`[Digest] Error processing digest for user ${user.user_id}:`, error);
      failed++;
    }
  }

  console.log(
    `[Digest] ${period} digest complete: ${sent} sent, ${failed} failed, ${skipped} skipped`,
  );

  return { sent, failed, skipped };
}
