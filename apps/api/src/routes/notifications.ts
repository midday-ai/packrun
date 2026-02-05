/**
 * Notifications Routes - API for user notifications and preferences
 */

import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { createId } from "@paralleldrive/cuid2";
import { eq, and, desc, sql } from "drizzle-orm";
import { auth } from "../lib/auth";
import { db } from "@packrun/db/client";
import { notification, notificationPreferences } from "@packrun/db/schema";
import {
  ErrorResponseSchema,
  SuccessResponseSchema,
  NotificationsListResponseSchema,
  UnreadCountResponseSchema,
  NotificationPreferencesResponseSchema,
  NotificationPreferencesSchema,
} from "./schemas/responses";

// Helper to get current user from session
async function getCurrentUser(c: { req: { raw: Request } }) {
  if (!auth) return null;
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  return session?.user || null;
}

// =============================================================================
// Route Definitions
// =============================================================================

const getNotificationsRoute = createRoute({
  method: "get",
  path: "/api/notifications",
  tags: ["Notifications"],
  summary: "Get notifications",
  description: "Get the user's notifications with optional filtering",
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      severity: z.string().optional().openapi({
        description: "Filter by severity (comma-separated: critical,important,info)",
        example: "critical,important",
      }),
      unreadOnly: z.string().optional().openapi({
        description: "Only return unread notifications",
        example: "true",
      }),
      limit: z.string().optional().openapi({
        description: "Maximum number of notifications to return",
        example: "20",
      }),
      offset: z.string().optional().openapi({
        description: "Offset for pagination",
        example: "0",
      }),
    }),
  },
  responses: {
    200: {
      content: { "application/json": { schema: NotificationsListResponseSchema } },
      description: "List of notifications",
    },
    401: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Unauthorized",
    },
    500: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Server error",
    },
  },
});

const getUnreadCountRoute = createRoute({
  method: "get",
  path: "/api/notifications/unread-count",
  tags: ["Notifications"],
  summary: "Get unread count",
  description: "Get the count of unread notifications (for badge display)",
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      content: { "application/json": { schema: UnreadCountResponseSchema } },
      description: "Unread notification counts",
    },
    401: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Unauthorized",
    },
  },
});

const markAsReadRoute = createRoute({
  method: "patch",
  path: "/api/notifications/{id}/read",
  tags: ["Notifications"],
  summary: "Mark notification as read",
  description: "Mark a single notification as read",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      id: z.string().openapi({
        param: { name: "id", in: "path" },
        description: "Notification ID",
      }),
    }),
  },
  responses: {
    200: {
      content: { "application/json": { schema: SuccessResponseSchema } },
      description: "Notification marked as read",
    },
    401: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Unauthorized",
    },
    404: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Notification not found",
    },
  },
});

const markAllAsReadRoute = createRoute({
  method: "post",
  path: "/api/notifications/read-all",
  tags: ["Notifications"],
  summary: "Mark all as read",
  description: "Mark all notifications as read",
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      content: { "application/json": { schema: SuccessResponseSchema } },
      description: "All notifications marked as read",
    },
    401: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Unauthorized",
    },
  },
});

const getPreferencesRoute = createRoute({
  method: "get",
  path: "/api/notifications/preferences",
  tags: ["Notifications"],
  summary: "Get notification preferences",
  description: "Get the user's notification preferences",
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      content: { "application/json": { schema: NotificationPreferencesResponseSchema } },
      description: "User's notification preferences",
    },
    401: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Unauthorized",
    },
  },
});

const updatePreferencesRoute = createRoute({
  method: "put",
  path: "/api/notifications/preferences",
  tags: ["Notifications"],
  summary: "Update notification preferences",
  description: "Update the user's notification preferences",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: NotificationPreferencesSchema.partial(),
        },
      },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: NotificationPreferencesResponseSchema } },
      description: "Updated preferences",
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

export function createNotificationsRoutes() {
  const app = new OpenAPIHono();

  // GET /api/notifications
  app.openapi(getNotificationsRoute, async (c) => {
    c.header("Cache-Control", "no-store, no-cache, must-revalidate");
    const user = await getCurrentUser(c);
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    if (!db) {
      return c.json({ error: "Database not configured" }, 500);
    }

    const { severity, unreadOnly, limit = "20", offset = "0" } = c.req.query();
    const limitNum = Math.min(parseInt(limit, 10) || 20, 100);
    const offsetNum = parseInt(offset, 10) || 0;

    try {
      // Build query conditions
      const conditions = [eq(notification.userId, user.id)];

      if (unreadOnly === "true") {
        conditions.push(eq(notification.read, false));
      }

      if (severity) {
        const severities = severity.split(",").filter(Boolean);
        if (severities.length > 0) {
          conditions.push(sql`${notification.severity} = ANY(${severities})`);
        }
      }

      // Get notifications
      const notifications = await db
        .select()
        .from(notification)
        .where(and(...conditions))
        .orderBy(desc(notification.createdAt))
        .limit(limitNum)
        .offset(offsetNum);

      // Get total and unread counts
      const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(notification)
        .where(eq(notification.userId, user.id));

      const [unreadResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(notification)
        .where(and(eq(notification.userId, user.id), eq(notification.read, false)));

      return c.json(
        {
          notifications: notifications.map((n) => ({
            id: n.id,
            packageName: n.packageName,
            newVersion: n.newVersion,
            previousVersion: n.previousVersion,
            severity: n.severity as "critical" | "important" | "info",
            isSecurityUpdate: n.isSecurityUpdate,
            isBreakingChange: n.isBreakingChange,
            changelogSnippet: n.changelogSnippet,
            vulnerabilitiesFixed: n.vulnerabilitiesFixed,
            read: n.read,
            createdAt: n.createdAt.toISOString(),
          })),
          total: Number(countResult?.count || 0),
          unreadCount: Number(unreadResult?.count || 0),
        },
        200,
      );
    } catch (error) {
      console.error("[Notifications] Error fetching:", error);
      return c.json({ error: "Failed to fetch notifications" }, 500);
    }
  });

  // GET /api/notifications/unread-count
  app.openapi(getUnreadCountRoute, async (c) => {
    c.header("Cache-Control", "no-store, no-cache, must-revalidate");
    const user = await getCurrentUser(c);
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    if (!db) {
      return c.json({ total: 0, critical: 0 }, 200);
    }

    try {
      const [totalResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(notification)
        .where(and(eq(notification.userId, user.id), eq(notification.read, false)));

      const [criticalResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(notification)
        .where(
          and(
            eq(notification.userId, user.id),
            eq(notification.read, false),
            eq(notification.severity, "critical"),
          ),
        );

      return c.json(
        {
          total: Number(totalResult?.count || 0),
          critical: Number(criticalResult?.count || 0),
        },
        200,
      );
    } catch (error) {
      console.error("[Notifications] Error fetching unread count:", error);
      return c.json({ total: 0, critical: 0 }, 200);
    }
  });

  // PATCH /api/notifications/:id/read
  app.openapi(markAsReadRoute, async (c) => {
    c.header("Cache-Control", "no-store");
    const user = await getCurrentUser(c);
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    if (!db) {
      return c.json({ error: "Database not configured" }, 500);
    }

    const notificationId = c.req.param("id");

    try {
      const result = await db
        .update(notification)
        .set({ read: true })
        .where(and(eq(notification.id, notificationId), eq(notification.userId, user.id)));

      return c.json({ success: true }, 200);
    } catch (error) {
      console.error("[Notifications] Error marking as read:", error);
      return c.json({ error: "Failed to mark notification as read" }, 500);
    }
  });

  // POST /api/notifications/read-all
  app.openapi(markAllAsReadRoute, async (c) => {
    c.header("Cache-Control", "no-store");
    const user = await getCurrentUser(c);
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    if (!db) {
      return c.json({ error: "Database not configured" }, 500);
    }

    try {
      await db
        .update(notification)
        .set({ read: true })
        .where(and(eq(notification.userId, user.id), eq(notification.read, false)));

      return c.json({ success: true }, 200);
    } catch (error) {
      console.error("[Notifications] Error marking all as read:", error);
      return c.json({ error: "Failed to mark notifications as read" }, 500);
    }
  });

  // GET /api/notifications/preferences
  app.openapi(getPreferencesRoute, async (c) => {
    c.header("Cache-Control", "no-store, no-cache, must-revalidate");
    const user = await getCurrentUser(c);
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    if (!db) {
      return c.json({ error: "Database not configured" }, 500);
    }

    try {
      const [prefs] = await db
        .select()
        .from(notificationPreferences)
        .where(eq(notificationPreferences.userId, user.id))
        .limit(1);

      // Return defaults if no preferences exist
      const preferences = prefs || {
        notifyAllUpdates: false,
        notifyMajorOnly: true,
        notifySecurityOnly: true,
        inAppEnabled: true,
        slackEnabled: false,
        emailDigestEnabled: false,
        emailDigestFrequency: "daily",
        emailImmediateCritical: true,
      };

      return c.json(
        {
          preferences: {
            notifyAllUpdates: preferences.notifyAllUpdates,
            notifyMajorOnly: preferences.notifyMajorOnly,
            notifySecurityOnly: preferences.notifySecurityOnly,
            inAppEnabled: preferences.inAppEnabled,
            slackEnabled: preferences.slackEnabled,
            emailDigestEnabled: preferences.emailDigestEnabled,
            emailDigestFrequency: preferences.emailDigestFrequency as "daily" | "weekly" | null,
            emailImmediateCritical: preferences.emailImmediateCritical,
          },
        },
        200,
      );
    } catch (error) {
      console.error("[Notifications] Error fetching preferences:", error);
      return c.json({ error: "Failed to fetch preferences" }, 500);
    }
  });

  // PUT /api/notifications/preferences
  app.openapi(updatePreferencesRoute, async (c) => {
    c.header("Cache-Control", "no-store");
    const user = await getCurrentUser(c);
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    if (!db) {
      return c.json({ error: "Database not configured" }, 500);
    }

    const body = await c.req.json();

    try {
      // Upsert preferences
      const [existing] = await db
        .select()
        .from(notificationPreferences)
        .where(eq(notificationPreferences.userId, user.id))
        .limit(1);

      let updated;
      if (existing) {
        [updated] = await db
          .update(notificationPreferences)
          .set(body)
          .where(eq(notificationPreferences.userId, user.id))
          .returning();
      } else {
        [updated] = await db
          .insert(notificationPreferences)
          .values({
            id: createId(),
            userId: user.id,
            ...body,
          })
          .returning();
      }

      return c.json(
        {
          preferences: {
            notifyAllUpdates: updated!.notifyAllUpdates,
            notifyMajorOnly: updated!.notifyMajorOnly,
            notifySecurityOnly: updated!.notifySecurityOnly,
            inAppEnabled: updated!.inAppEnabled,
            slackEnabled: updated!.slackEnabled,
            emailDigestEnabled: updated!.emailDigestEnabled,
            emailDigestFrequency: updated!.emailDigestFrequency as "daily" | "weekly" | null,
            emailImmediateCritical: updated!.emailImmediateCritical,
          },
        },
        200,
      );
    } catch (error) {
      console.error("[Notifications] Error updating preferences:", error);
      return c.json({ error: "Failed to update preferences" }, 500);
    }
  });

  return app;
}
