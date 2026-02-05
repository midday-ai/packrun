/**
 * Admin Routes - Internal routes for health check and testing (not in OpenAPI docs)
 */

import { Hono } from "hono";
import { sendEmail, Digest, type DigestUpdate } from "@packrun/email";
import React from "react";

export function createAdminRoutes() {
  const app = new Hono();

  // GET /health
  app.get("/health", (c) => {
    return c.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      service: "packrun-api",
    });
  });

  // POST /test-email - Send a test digest email
  // Requires ADMIN_SECRET header for protection
  app.post("/test-email", async (c) => {
    const adminSecret = c.req.header("x-admin-secret");
    if (adminSecret !== process.env.ADMIN_SECRET) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const body = await c.req.json<{ email: string; package?: string }>();
    const { email, package: packageName = "ai" } = body;

    if (!email) {
      return c.json({ error: "email is required" }, 400);
    }

    const updates: DigestUpdate[] = [
      {
        packageName,
        newVersion: "4.1.0",
        previousVersion: "4.0.3",
        severity: "critical",
        isSecurityUpdate: true,
        isBreakingChange: false,
        vulnerabilitiesFixed: 1,
        changelogSnippet: "Security fix for prompt injection vulnerability",
      },
      {
        packageName,
        newVersion: "4.0.0",
        previousVersion: "3.4.7",
        severity: "important",
        isSecurityUpdate: false,
        isBreakingChange: true,
        changelogSnippet: "New streaming API, deprecated generateText()",
      },
      {
        packageName: `@${packageName}-sdk/provider`,
        newVersion: "1.2.0",
        previousVersion: "1.1.0",
        severity: "info",
        isSecurityUpdate: false,
        isBreakingChange: false,
      },
    ];

    const emailElement = React.createElement(Digest, {
      updates,
      period: "daily",
      unsubscribeUrl: "https://packrun.dev/api/unsubscribe?token=test",
    });

    try {
      const result = await sendEmail({
        to: email,
        subject: `📦 Test digest: ${updates.length} package updates`,
        react: emailElement,
      });

      return c.json({ success: true, result });
    } catch (error) {
      console.error("[Admin] Test email error:", error);
      return c.json({ error: "Failed to send email", details: String(error) }, 500);
    }
  });

  return app;
}
