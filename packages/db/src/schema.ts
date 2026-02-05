/**
 * Database Schema
 *
 * All table definitions and relations for the packrun.dev database.
 */

import { relations } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  boolean,
  index,
  uniqueIndex,
  integer,
  jsonb,
} from "drizzle-orm/pg-core";

// =============================================================================
// Auth Tables (Better Auth)
// =============================================================================

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("session_userId_idx").on(table.userId),
    index("session_token_idx").on(table.token),
  ],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

// =============================================================================
// Favorites
// =============================================================================

export const favorite = pgTable(
  "favorite",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    packageName: text("package_name").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("favorite_userId_idx").on(table.userId),
    index("favorite_packageName_idx").on(table.packageName),
    uniqueIndex("favorite_unique").on(table.userId, table.packageName),
  ],
);

// =============================================================================
// Notification Tables
// =============================================================================

export const notification = pgTable(
  "notification",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    packageName: text("package_name").notNull(),

    // Version info
    newVersion: text("new_version").notNull(),
    previousVersion: text("previous_version"),

    // Severity: "critical" | "important" | "info"
    severity: text("severity").notNull().default("info"),

    // Flags
    isSecurityUpdate: boolean("is_security_update").default(false).notNull(),
    isBreakingChange: boolean("is_breaking_change").default(false).notNull(),

    // Enrichment data
    changelogSnippet: text("changelog_snippet"),
    vulnerabilitiesFixed: integer("vulnerabilities_fixed"),

    // State
    read: boolean("read").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("notification_userId_idx").on(table.userId),
    index("notification_userId_read_idx").on(table.userId, table.read),
    index("notification_userId_severity_idx").on(table.userId, table.severity),
    uniqueIndex("notification_unique").on(table.userId, table.packageName, table.newVersion),
  ],
);

export const notificationPreferences = pgTable("notification_preferences", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" })
    .unique(),

  // What to notify about
  notifyAllUpdates: boolean("notify_all_updates").default(false).notNull(),
  notifyMajorOnly: boolean("notify_major_only").default(true).notNull(),
  notifySecurityOnly: boolean("notify_security_only").default(true).notNull(),

  // Channel preferences
  inAppEnabled: boolean("in_app_enabled").default(true).notNull(),
  slackEnabled: boolean("slack_enabled").default(false).notNull(),
  emailDigestEnabled: boolean("email_digest_enabled").default(false).notNull(),
  emailDigestFrequency: text("email_digest_frequency").default("daily"), // "daily" | "weekly"
  emailImmediateCritical: boolean("email_immediate_critical").default(true).notNull(),

  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const integrationConnection = pgTable(
  "integration_connection",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // Provider: "slack" | "discord" | "teams" | "webhook"
    provider: text("provider").notNull(),

    // Display name for UI (e.g., "Slack - #engineering")
    displayName: text("display_name").notNull(),

    // Provider-specific config as JSON
    // Slack: { teamId, teamName, channelId, channelName, accessToken }
    // Discord: { webhookUrl, guildName, channelName }
    // Webhook: { url, secret, headers }
    config: jsonb("config").notNull(),

    // State
    enabled: boolean("enabled").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("integration_userId_idx").on(table.userId),
    index("integration_userId_provider_idx").on(table.userId, table.provider),
  ],
);

// =============================================================================
// Relations
// =============================================================================

export const userRelations = relations(user, ({ many, one }) => ({
  accounts: many(account),
  sessions: many(session),
  favorites: many(favorite),
  notifications: many(notification),
  notificationPreferences: one(notificationPreferences),
  integrationConnections: many(integrationConnection),
}));

export const favoriteRelations = relations(favorite, ({ one }) => ({
  user: one(user, {
    fields: [favorite.userId],
    references: [user.id],
  }),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const notificationRelations = relations(notification, ({ one }) => ({
  user: one(user, {
    fields: [notification.userId],
    references: [user.id],
  }),
}));

export const notificationPreferencesRelations = relations(notificationPreferences, ({ one }) => ({
  user: one(user, {
    fields: [notificationPreferences.userId],
    references: [user.id],
  }),
}));

export const integrationConnectionRelations = relations(integrationConnection, ({ one }) => ({
  user: one(user, {
    fields: [integrationConnection.userId],
    references: [user.id],
  }),
}));
