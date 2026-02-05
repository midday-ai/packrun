/**
 * Integrations Routes - API for managing external integrations (Slack, etc.)
 */

import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { createId } from "@paralleldrive/cuid2";
import { eq, and } from "drizzle-orm";
import { auth } from "../lib/auth";
import { db } from "@packrun/db/client";
import { integrationConnection } from "@packrun/db/schema";
import {
  ErrorResponseSchema,
  SuccessResponseSchema,
  IntegrationsListResponseSchema,
  SlackChannelsResponseSchema,
  SlackConnectResponseSchema,
} from "./schemas/responses";

// Helper to get current user from session
async function getCurrentUser(c: { req: { raw: Request } }) {
  if (!auth) return null;
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  return session?.user || null;
}

// Slack OAuth configuration
const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID;
const SLACK_CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET;
const SLACK_REDIRECT_URI =
  process.env.NODE_ENV === "production"
    ? "https://api.packrun.dev/api/integrations/slack/callback"
    : "http://localhost:3001/api/integrations/slack/callback";

// =============================================================================
// Route Definitions
// =============================================================================

const getIntegrationsRoute = createRoute({
  method: "get",
  path: "/api/integrations",
  tags: ["Integrations"],
  summary: "List integrations",
  description: "Get all connected integrations for the user",
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      content: { "application/json": { schema: IntegrationsListResponseSchema } },
      description: "List of integrations",
    },
    401: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Unauthorized",
    },
  },
});

const deleteIntegrationRoute = createRoute({
  method: "delete",
  path: "/api/integrations/{id}",
  tags: ["Integrations"],
  summary: "Remove integration",
  description: "Disconnect an integration",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      id: z.string().openapi({
        param: { name: "id", in: "path" },
        description: "Integration ID",
      }),
    }),
  },
  responses: {
    200: {
      content: { "application/json": { schema: SuccessResponseSchema } },
      description: "Integration removed",
    },
    401: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Unauthorized",
    },
    404: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Integration not found",
    },
  },
});

const toggleIntegrationRoute = createRoute({
  method: "patch",
  path: "/api/integrations/{id}",
  tags: ["Integrations"],
  summary: "Toggle integration",
  description: "Enable or disable an integration",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      id: z.string().openapi({
        param: { name: "id", in: "path" },
        description: "Integration ID",
      }),
    }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            enabled: z.boolean(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: SuccessResponseSchema } },
      description: "Integration updated",
    },
    401: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Unauthorized",
    },
  },
});

const slackConnectRoute = createRoute({
  method: "get",
  path: "/api/integrations/slack/connect",
  tags: ["Integrations"],
  summary: "Connect Slack",
  description: "Get Slack OAuth URL to connect workspace",
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      content: { "application/json": { schema: SlackConnectResponseSchema } },
      description: "Slack OAuth URL",
    },
    401: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Unauthorized",
    },
    500: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Slack not configured",
    },
  },
});

const slackCallbackRoute = createRoute({
  method: "get",
  path: "/api/integrations/slack/callback",
  tags: ["Integrations"],
  summary: "Slack OAuth callback",
  description: "Handle Slack OAuth callback",
  request: {
    query: z.object({
      code: z.string().optional(),
      error: z.string().optional(),
      state: z.string().optional(),
    }),
  },
  responses: {
    302: {
      description: "Redirect to profile page",
    },
  },
});

const slackChannelsRoute = createRoute({
  method: "get",
  path: "/api/integrations/slack/channels",
  tags: ["Integrations"],
  summary: "List Slack channels",
  description: "Get available Slack channels for the connected workspace",
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      integrationId: z.string().openapi({
        description: "Integration ID",
      }),
    }),
  },
  responses: {
    200: {
      content: { "application/json": { schema: SlackChannelsResponseSchema } },
      description: "List of Slack channels",
    },
    401: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Unauthorized",
    },
    404: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Integration not found",
    },
  },
});

const updateSlackChannelRoute = createRoute({
  method: "put",
  path: "/api/integrations/slack/{id}/channel",
  tags: ["Integrations"],
  summary: "Update Slack channel",
  description: "Change the Slack channel for notifications",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      id: z.string().openapi({
        param: { name: "id", in: "path" },
        description: "Integration ID",
      }),
    }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            channelId: z.string(),
            channelName: z.string(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: SuccessResponseSchema } },
      description: "Channel updated",
    },
    401: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Unauthorized",
    },
  },
});

// =============================================================================
// Create Router
// =============================================================================

export function createIntegrationsRoutes() {
  const app = new OpenAPIHono();

  // GET /api/integrations
  app.openapi(getIntegrationsRoute, async (c) => {
    c.header("Cache-Control", "no-store, no-cache, must-revalidate");
    const user = await getCurrentUser(c);
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    if (!db) {
      return c.json({ integrations: [] }, 200);
    }

    try {
      const integrations = await db
        .select({
          id: integrationConnection.id,
          provider: integrationConnection.provider,
          displayName: integrationConnection.displayName,
          enabled: integrationConnection.enabled,
          createdAt: integrationConnection.createdAt,
        })
        .from(integrationConnection)
        .where(eq(integrationConnection.userId, user.id));

      return c.json(
        {
          integrations: integrations.map((i) => ({
            ...i,
            createdAt: i.createdAt.toISOString(),
          })),
        },
        200,
      );
    } catch (error) {
      console.error("[Integrations] Error fetching:", error);
      return c.json({ integrations: [] }, 200);
    }
  });

  // DELETE /api/integrations/:id
  app.openapi(deleteIntegrationRoute, async (c) => {
    c.header("Cache-Control", "no-store");
    const user = await getCurrentUser(c);
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    if (!db) {
      return c.json({ error: "Database not configured" }, 500);
    }

    const integrationId = c.req.param("id");

    try {
      const result = await db
        .delete(integrationConnection)
        .where(
          and(
            eq(integrationConnection.id, integrationId),
            eq(integrationConnection.userId, user.id),
          ),
        );

      return c.json({ success: true }, 200);
    } catch (error) {
      console.error("[Integrations] Error deleting:", error);
      return c.json({ error: "Failed to delete integration" }, 500);
    }
  });

  // PATCH /api/integrations/:id
  app.openapi(toggleIntegrationRoute, async (c) => {
    c.header("Cache-Control", "no-store");
    const user = await getCurrentUser(c);
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    if (!db) {
      return c.json({ error: "Database not configured" }, 500);
    }

    const integrationId = c.req.param("id");
    const { enabled } = await c.req.json();

    try {
      await db
        .update(integrationConnection)
        .set({ enabled })
        .where(
          and(
            eq(integrationConnection.id, integrationId),
            eq(integrationConnection.userId, user.id),
          ),
        );

      return c.json({ success: true }, 200);
    } catch (error) {
      console.error("[Integrations] Error toggling:", error);
      return c.json({ error: "Failed to update integration" }, 500);
    }
  });

  // GET /api/integrations/slack/connect
  app.openapi(slackConnectRoute, async (c) => {
    const user = await getCurrentUser(c);
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    if (!SLACK_CLIENT_ID) {
      return c.json({ error: "Slack integration not configured" }, 500);
    }

    // Generate state token for CSRF protection
    const state = Buffer.from(JSON.stringify({ userId: user.id, ts: Date.now() })).toString(
      "base64url",
    );

    const params = new URLSearchParams({
      client_id: SLACK_CLIENT_ID,
      scope: "chat:write,channels:read,groups:read",
      redirect_uri: SLACK_REDIRECT_URI,
      state,
    });

    const url = `https://slack.com/oauth/v2/authorize?${params.toString()}`;

    return c.json({ url }, 200);
  });

  // GET /api/integrations/slack/callback
  app.openapi(slackCallbackRoute, async (c) => {
    const { code, error, state } = c.req.query();
    const frontendUrl =
      process.env.NODE_ENV === "production" ? "https://packrun.dev" : "http://localhost:3000";

    if (error) {
      console.error("[Slack] OAuth error:", error);
      return c.redirect(`${frontendUrl}/profile?slack=error&message=${encodeURIComponent(error)}`);
    }

    if (!code || !state) {
      return c.redirect(`${frontendUrl}/profile?slack=error&message=missing_params`);
    }

    // Verify state and extract userId
    let userId: string;
    try {
      const stateData = JSON.parse(Buffer.from(state, "base64url").toString());
      userId = stateData.userId;

      // Check state isn't too old (15 minutes)
      if (Date.now() - stateData.ts > 15 * 60 * 1000) {
        return c.redirect(`${frontendUrl}/profile?slack=error&message=state_expired`);
      }
    } catch {
      return c.redirect(`${frontendUrl}/profile?slack=error&message=invalid_state`);
    }

    if (!SLACK_CLIENT_ID || !SLACK_CLIENT_SECRET) {
      return c.redirect(`${frontendUrl}/profile?slack=error&message=not_configured`);
    }

    try {
      // Exchange code for access token
      const tokenResponse = await fetch("https://slack.com/api/oauth.v2.access", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: SLACK_CLIENT_ID,
          client_secret: SLACK_CLIENT_SECRET,
          code,
          redirect_uri: SLACK_REDIRECT_URI,
        }),
      });

      const tokenData = await tokenResponse.json();

      if (!tokenData.ok) {
        console.error("[Slack] Token exchange failed:", tokenData.error);
        return c.redirect(
          `${frontendUrl}/profile?slack=error&message=${encodeURIComponent(tokenData.error)}`,
        );
      }

      // Get default channel (first public channel bot is in)
      const channelsResponse = await fetch(
        "https://slack.com/api/conversations.list?types=public_channel&limit=100",
        {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        },
      );

      const channelsData = await channelsResponse.json();
      const firstChannel = channelsData.channels?.[0];

      if (!db) {
        return c.redirect(`${frontendUrl}/profile?slack=error&message=db_not_configured`);
      }

      // Save integration
      await db.insert(integrationConnection).values({
        id: createId(),
        userId,
        provider: "slack",
        displayName: `Slack - #${firstChannel?.name || "general"}`,
        config: {
          teamId: tokenData.team.id,
          teamName: tokenData.team.name,
          channelId: firstChannel?.id || "",
          channelName: firstChannel?.name || "",
          accessToken: tokenData.access_token,
          botUserId: tokenData.bot_user_id,
        },
        enabled: true,
      });

      return c.redirect(`${frontendUrl}/profile?slack=success`);
    } catch (error) {
      console.error("[Slack] OAuth error:", error);
      return c.redirect(`${frontendUrl}/profile?slack=error&message=unexpected_error`);
    }
  });

  // GET /api/integrations/slack/channels
  app.openapi(slackChannelsRoute, async (c) => {
    c.header("Cache-Control", "no-store");
    const user = await getCurrentUser(c);
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    if (!db) {
      return c.json({ error: "Database not configured" }, 500);
    }

    const { integrationId } = c.req.query();

    try {
      const [integration] = await db
        .select()
        .from(integrationConnection)
        .where(
          and(
            eq(integrationConnection.id, integrationId),
            eq(integrationConnection.userId, user.id),
            eq(integrationConnection.provider, "slack"),
          ),
        )
        .limit(1);

      if (!integration) {
        return c.json({ error: "Integration not found" }, 404);
      }

      const config = integration.config as { accessToken: string };

      // Fetch channels from Slack
      const response = await fetch(
        "https://slack.com/api/conversations.list?types=public_channel,private_channel&limit=200",
        {
          headers: { Authorization: `Bearer ${config.accessToken}` },
        },
      );

      const data = await response.json();

      if (!data.ok) {
        console.error("[Slack] Error fetching channels:", data.error);
        return c.json({ channels: [] }, 200);
      }

      const channels = data.channels.map(
        (ch: { id: string; name: string; is_private: boolean }) => ({
          id: ch.id,
          name: ch.name,
          isPrivate: ch.is_private,
        }),
      );

      return c.json({ channels }, 200);
    } catch (error) {
      console.error("[Integrations] Error fetching Slack channels:", error);
      return c.json({ channels: [] }, 200);
    }
  });

  // PUT /api/integrations/slack/:id/channel
  app.openapi(updateSlackChannelRoute, async (c) => {
    c.header("Cache-Control", "no-store");
    const user = await getCurrentUser(c);
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    if (!db) {
      return c.json({ error: "Database not configured" }, 500);
    }

    const integrationId = c.req.param("id");
    const { channelId, channelName } = await c.req.json();

    try {
      const [integration] = await db
        .select()
        .from(integrationConnection)
        .where(
          and(
            eq(integrationConnection.id, integrationId),
            eq(integrationConnection.userId, user.id),
            eq(integrationConnection.provider, "slack"),
          ),
        )
        .limit(1);

      if (!integration) {
        return c.json({ error: "Integration not found" }, 404);
      }

      const config = integration.config as Record<string, unknown>;

      await db
        .update(integrationConnection)
        .set({
          displayName: `Slack - #${channelName}`,
          config: {
            ...config,
            channelId,
            channelName,
          },
        })
        .where(eq(integrationConnection.id, integrationId));

      return c.json({ success: true }, 200);
    } catch (error) {
      console.error("[Integrations] Error updating Slack channel:", error);
      return c.json({ error: "Failed to update channel" }, 500);
    }
  });

  return app;
}
