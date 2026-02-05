/**
 * Resend Email Client
 *
 * Handles email sending with support for:
 * - RFC 8058 one-click unsubscribe (Gmail native button)
 * - Rate limit handling
 */

import { createHmac } from "node:crypto";
import type { ReactElement } from "react";
import { Resend } from "resend";

// Initialize Resend client (null if no API key)
const apiKey = process.env.RESEND_API_KEY;
export const resend = apiKey ? new Resend(apiKey) : null;

export interface SendEmailOptions {
  to: string;
  subject: string;
  react: ReactElement;
  userId?: string; // For generating unsubscribe token
}

/**
 * Generate unsubscribe token using HMAC
 */
export function generateUnsubscribeToken(userId: string, action: "all" | "digest" = "all"): string {
  const secret = process.env.UNSUBSCRIBE_SECRET;
  if (!secret) {
    throw new Error("UNSUBSCRIBE_SECRET not configured");
  }

  const payload = `${userId}:${action}:${Date.now()}`;
  const signature = createHmac("sha256", secret).update(payload).digest("hex").slice(0, 16);
  return Buffer.from(`${payload}:${signature}`).toString("base64url");
}

/**
 * Verify unsubscribe token
 */
export function verifyUnsubscribeToken(token: string): { userId: string; action: string } | null {
  const secret = process.env.UNSUBSCRIBE_SECRET;
  if (!secret) return null;

  try {
    const decoded = Buffer.from(token, "base64url").toString();
    const parts = decoded.split(":");
    if (parts.length !== 4) return null;

    const [userId, action, timestamp, signature] = parts;
    const expected = createHmac("sha256", secret)
      .update(`${userId}:${action}:${timestamp}`)
      .digest("hex")
      .slice(0, 16);

    if (signature !== expected) return null;

    // Token expires after 30 days
    const tokenAge = Date.now() - parseInt(timestamp!, 10);
    if (tokenAge > 30 * 24 * 60 * 60 * 1000) return null;

    return { userId: userId!, action: action! };
  } catch {
    return null;
  }
}

/**
 * Send email with optional unsubscribe headers (RFC 8058)
 */
export async function sendEmail({ to, subject, react, userId }: SendEmailOptions) {
  if (!resend) {
    console.warn("[Email] Resend not configured, skipping email send");
    return null;
  }

  const headers: Record<string, string> = {};

  // Add RFC 8058 unsubscribe headers if userId provided
  if (userId) {
    const token = generateUnsubscribeToken(userId);
    const unsubscribeUrl = `https://packrun.dev/api/unsubscribe?token=${token}`;

    headers["List-Unsubscribe"] = `<${unsubscribeUrl}>`;
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }

  try {
    const result = await resend.emails.send({
      from: "packrun.dev <notifications@packrun.dev>",
      to,
      subject,
      react,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
    });

    return result;
  } catch (error) {
    // Handle rate limiting
    if (error instanceof Error && error.message.includes("rate")) {
      console.error("[Email] Rate limited:", error.message);
      throw new RateLimitError("Email rate limited", 60);
    }
    throw error;
  }
}

/**
 * Custom error for rate limiting
 */
export class RateLimitError extends Error {
  retryAfter: number;

  constructor(message: string, retryAfter: number) {
    super(message);
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
  }
}
