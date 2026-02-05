/**
 * Unsubscribe Handler
 *
 * Email unsubscribe endpoints (RFC 8058 compliant).
 * This is a standalone handler (not oRPC) because it returns HTML pages.
 *
 * Supports:
 * - GET: Browser click from email footer (shows confirmation page)
 * - POST: Gmail one-click unsubscribe (returns 200 OK)
 */

import { createHmac } from "node:crypto";
import { db } from "@packrun/db/client";
import { disableEmailNotifications } from "@packrun/db/queries";
import { createId } from "@paralleldrive/cuid2";

const UNSUBSCRIBE_SECRET = process.env.UNSUBSCRIBE_SECRET;

/**
 * Verify unsubscribe token
 */
function verifyUnsubscribeToken(token: string): { userId: string; action: string } | null {
  if (!UNSUBSCRIBE_SECRET) return null;

  try {
    const decoded = Buffer.from(token, "base64url").toString();
    const parts = decoded.split(":");
    if (parts.length !== 4) return null;

    const [userId, action, timestamp, signature] = parts;
    const expected = createHmac("sha256", UNSUBSCRIBE_SECRET)
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
 * Create an HTML response
 */
function htmlResponse(html: string, status = 200): Response {
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

/**
 * Create a text response
 */
function textResponse(text: string, status = 200): Response {
  return new Response(text, {
    status,
    headers: { "Content-Type": "text/plain" },
  });
}

const HTML_STYLE = `
  body { font-family: -apple-system, system-ui, sans-serif; padding: 40px 20px; max-width: 500px; margin: 0 auto; text-align: center; }
  h1 { color: #0a0a0a; }
  h1.error { color: #dc2626; }
  .checkmark { font-size: 48px; margin-bottom: 16px; }
  p { color: #666; line-height: 1.6; }
  a { color: #0a0a0a; }
`;

/**
 * Handle unsubscribe request
 */
export async function handleUnsubscribe(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  // POST: Gmail one-click unsubscribe (RFC 8058)
  if (request.method === "POST") {
    if (!token) {
      return textResponse("Missing token", 400);
    }

    const result = verifyUnsubscribeToken(token);
    if (!result) {
      return textResponse("Invalid or expired token", 400);
    }

    if (!db) {
      return textResponse("Database not configured", 500);
    }

    const success = await disableEmailNotifications(db, createId(), result.userId);
    if (!success) {
      return textResponse("Failed to unsubscribe", 500);
    }

    // Gmail expects 200 OK
    return textResponse("OK", 200);
  }

  // GET: Browser click from email footer
  if (!token) {
    return htmlResponse(
      `<!DOCTYPE html>
      <html>
        <head>
          <title>Unsubscribe - packrun.dev</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>${HTML_STYLE}</style>
        </head>
        <body>
          <h1 class="error">Invalid Link</h1>
          <p>This unsubscribe link is missing required parameters.</p>
          <p><a href="https://packrun.dev/profile">Manage your preferences</a></p>
        </body>
      </html>`,
      400,
    );
  }

  const result = verifyUnsubscribeToken(token);
  if (!result) {
    return htmlResponse(
      `<!DOCTYPE html>
      <html>
        <head>
          <title>Unsubscribe - packrun.dev</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>${HTML_STYLE}</style>
        </head>
        <body>
          <h1 class="error">Link Expired</h1>
          <p>This unsubscribe link has expired or is invalid.</p>
          <p><a href="https://packrun.dev/profile">Manage your preferences</a></p>
        </body>
      </html>`,
      400,
    );
  }

  if (!db) {
    return htmlResponse(
      `<!DOCTYPE html>
      <html>
        <head>
          <title>Unsubscribe - packrun.dev</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>${HTML_STYLE}</style>
        </head>
        <body>
          <h1 class="error">Error</h1>
          <p>Service temporarily unavailable. Please try again later.</p>
          <p><a href="https://packrun.dev/profile">Manage your preferences</a></p>
        </body>
      </html>`,
      500,
    );
  }

  const success = await disableEmailNotifications(db, createId(), result.userId);

  if (!success) {
    return htmlResponse(
      `<!DOCTYPE html>
      <html>
        <head>
          <title>Unsubscribe - packrun.dev</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>${HTML_STYLE}</style>
        </head>
        <body>
          <h1 class="error">Error</h1>
          <p>Something went wrong. Please try again later.</p>
          <p><a href="https://packrun.dev/profile">Manage your preferences</a></p>
        </body>
      </html>`,
      500,
    );
  }

  return htmlResponse(
    `<!DOCTYPE html>
    <html>
      <head>
        <title>Unsubscribed - packrun.dev</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>${HTML_STYLE}</style>
      </head>
      <body>
        <div class="checkmark">✓</div>
        <h1>Unsubscribed</h1>
        <p>You've been unsubscribed from packrun.dev email notifications.</p>
        <p>You can still receive in-app notifications when you visit the site.</p>
        <p style="margin-top: 24px;"><a href="https://packrun.dev/profile">Manage all preferences</a></p>
      </body>
    </html>`,
    200,
  );
}
