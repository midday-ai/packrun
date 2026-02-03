/**
 * Admin Routes - Internal routes for health check and backfill (not in OpenAPI docs)
 */

import { Hono } from "hono";
import {
  getBackfillStatus,
  pauseBackfill,
  requestBackfillStart,
  resetBackfill,
  resumeBackfill,
} from "../lib/backfill";

// =============================================================================
// Create Router (using regular Hono, not OpenAPIHono - excluded from docs)
// =============================================================================

export function createAdminRoutes() {
  const app = new Hono();

  // GET /health
  app.get("/health", (c) => {
    return c.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      service: "v1-api",
    });
  });

  // GET /api/backfill/status
  app.get("/api/backfill/status", async (c) => {
    try {
      const status = await getBackfillStatus();
      c.header("Cache-Control", "no-store");
      return c.json(status);
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
    }
  });

  // POST /api/backfill/start
  app.post("/api/backfill/start", async (c) => {
    try {
      const state = await requestBackfillStart();
      return c.json({
        message: "Backfill started. Worker will fetch all packages and begin processing.",
        state,
      });
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 400);
    }
  });

  // POST /api/backfill/pause
  app.post("/api/backfill/pause", async (c) => {
    try {
      const state = await pauseBackfill();
      return c.json({ message: "Backfill paused.", state });
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 400);
    }
  });

  // POST /api/backfill/resume
  app.post("/api/backfill/resume", async (c) => {
    try {
      const state = await resumeBackfill();
      return c.json({ message: "Backfill resumed.", state });
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 400);
    }
  });

  // POST /api/backfill/reset
  app.post("/api/backfill/reset", async (c) => {
    try {
      const state = await resetBackfill();
      return c.json({ message: "Backfill reset to idle.", state });
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : "Unknown error" }, 400);
    }
  });

  return app;
}
