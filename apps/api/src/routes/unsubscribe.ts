/**
 * Unsubscribe Routes - Email unsubscribe endpoints (RFC 8058 compliant)
 *
 * Supports:
 * - GET: Browser click from email footer (shows confirmation page)
 * - POST: Gmail one-click unsubscribe (returns 200 OK)
 */

import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db } from "@packrun/db/client";
import { notificationPreferences } from "@packrun/db/schema";
import { createId } from "@paralleldrive/cuid2";
import { createHmac } from "crypto";

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
 * Disable email notifications for a user
 */
async function disableEmailNotifications(userId: string): Promise<boolean> {
  if (!db) return false;

  try {
    // Check if preferences exist
    const [existing] = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId))
      .limit(1);

    if (existing) {
      await db
        .update(notificationPreferences)
        .set({
          emailDigestEnabled: false,
          emailImmediateCritical: false,
        })
        .where(eq(notificationPreferences.userId, userId));
    } else {
      // Create preferences with email disabled
      await db.insert(notificationPreferences).values({
        id: createId(),
        userId,
        emailDigestEnabled: false,
        emailImmediateCritical: false,
      });
    }

    return true;
  } catch (error) {
    console.error("[Unsubscribe] Error disabling email:", error);
    return false;
  }
}

// =============================================================================
// Create Router
// =============================================================================

export function createUnsubscribeRoutes() {
  const app = new Hono();

  // POST /api/unsubscribe - Gmail one-click (RFC 8058)
  // Gmail sends: List-Unsubscribe=One-Click in body
  app.post("/api/unsubscribe", async (c) => {
    const token = c.req.query("token");
    if (!token) {
      return c.text("Missing token", 400);
    }

    const result = verifyUnsubscribeToken(token);
    if (!result) {
      return c.text("Invalid or expired token", 400);
    }

    const success = await disableEmailNotifications(result.userId);
    if (!success) {
      return c.text("Failed to unsubscribe", 500);
    }

    // Gmail expects 200 OK
    return c.text("OK", 200);
  });

  // GET /api/unsubscribe - Browser click from email footer
  app.get("/api/unsubscribe", async (c) => {
    const token = c.req.query("token");
    if (!token) {
      return c.html(
        `<!DOCTYPE html>
        <html>
          <head>
            <title>Unsubscribe - packrun.dev</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body { font-family: -apple-system, system-ui, sans-serif; padding: 40px 20px; max-width: 500px; margin: 0 auto; text-align: center; }
              h1 { color: #dc2626; }
              p { color: #666; line-height: 1.6; }
              a { color: #0a0a0a; }
            </style>
          </head>
          <body>
            <h1>Invalid Link</h1>
            <p>This unsubscribe link is missing required parameters.</p>
            <p><a href="https://packrun.dev/profile">Manage your preferences</a></p>
          </body>
        </html>`,
        400,
      );
    }

    const result = verifyUnsubscribeToken(token);
    if (!result) {
      return c.html(
        `<!DOCTYPE html>
        <html>
          <head>
            <title>Unsubscribe - packrun.dev</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body { font-family: -apple-system, system-ui, sans-serif; padding: 40px 20px; max-width: 500px; margin: 0 auto; text-align: center; }
              h1 { color: #dc2626; }
              p { color: #666; line-height: 1.6; }
              a { color: #0a0a0a; }
            </style>
          </head>
          <body>
            <h1>Link Expired</h1>
            <p>This unsubscribe link has expired or is invalid.</p>
            <p><a href="https://packrun.dev/profile">Manage your preferences</a></p>
          </body>
        </html>`,
        400,
      );
    }

    const success = await disableEmailNotifications(result.userId);

    if (!success) {
      return c.html(
        `<!DOCTYPE html>
        <html>
          <head>
            <title>Unsubscribe - packrun.dev</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body { font-family: -apple-system, system-ui, sans-serif; padding: 40px 20px; max-width: 500px; margin: 0 auto; text-align: center; }
              h1 { color: #dc2626; }
              p { color: #666; line-height: 1.6; }
              a { color: #0a0a0a; }
            </style>
          </head>
          <body>
            <h1>Error</h1>
            <p>Something went wrong. Please try again later.</p>
            <p><a href="https://packrun.dev/profile">Manage your preferences</a></p>
          </body>
        </html>`,
        500,
      );
    }

    return c.html(
      `<!DOCTYPE html>
      <html>
        <head>
          <title>Unsubscribed - packrun.dev</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: -apple-system, system-ui, sans-serif; padding: 40px 20px; max-width: 500px; margin: 0 auto; text-align: center; }
            h1 { color: #0a0a0a; }
            .checkmark { font-size: 48px; margin-bottom: 16px; }
            p { color: #666; line-height: 1.6; }
            a { color: #0a0a0a; }
          </style>
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
  });

  return app;
}
