/**
 * Admin Routes - Internal routes for health check (not in OpenAPI docs)
 */

import { Hono } from "hono";

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

  return app;
}
