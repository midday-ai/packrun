/**
 * Database Schema
 *
 * All table definitions and relations for the packrun.dev database.
 */

import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
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
// Package Follow (users following packages for notifications)
// =============================================================================

export const packageFollow = pgTable(
  "package_follow",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    packageName: text("package_name").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("packageFollow_userId_idx").on(table.userId),
    index("packageFollow_packageName_idx").on(table.packageName),
    uniqueIndex("packageFollow_unique").on(table.userId, table.packageName),
  ],
);

// =============================================================================
// Upcoming Releases
// =============================================================================

export const upcomingRelease = pgTable(
  "upcoming_release",
  {
    id: text("id").primaryKey(),
    packageName: text("package_name"), // nullable - can exist without linked package
    title: text("title").notNull(), // e.g., "Drizzle v1.0"
    description: text("description"), // markdown, features/highlights

    // Version matching
    targetVersion: text("target_version").notNull(), // e.g., "1.0.0" or "1.x"
    versionMatchType: text("version_match_type").notNull().default("exact"), // "exact" | "major"

    // Release tracking
    releasedVersion: text("released_version"), // actual version when released
    releasedAt: timestamp("released_at"), // when it actually released
    status: text("status").notNull().default("upcoming"), // "upcoming" | "released"

    // Display
    logoUrl: text("logo_url"), // from logo.dev
    websiteUrl: text("website_url"), // official announcement/docs link
    expectedDate: timestamp("expected_date"), // optional expected release date

    // Metadata
    submittedById: text("submitted_by_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    featured: boolean("featured").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("upcomingRelease_packageName_idx").on(table.packageName),
    index("upcomingRelease_status_idx").on(table.status),
    index("upcomingRelease_packageStatus_idx").on(table.packageName, table.status),
    index("upcomingRelease_submittedBy_idx").on(table.submittedById),
    index("upcomingRelease_featured_idx").on(table.featured),
  ],
);

export const releaseFollow = pgTable(
  "release_follow",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    releaseId: text("release_id")
      .notNull()
      .references(() => upcomingRelease.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("releaseFollow_userId_idx").on(table.userId),
    index("releaseFollow_releaseId_idx").on(table.releaseId),
    uniqueIndex("releaseFollow_unique").on(table.userId, table.releaseId),
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
  emailDigestEnabled: boolean("email_digest_enabled").default(false).notNull(),
  emailDigestFrequency: text("email_digest_frequency").default("daily"), // "daily" | "weekly"
  emailImmediateCritical: boolean("email_immediate_critical").default(true).notNull(),

  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// =============================================================================
// Relations
// =============================================================================

export const userRelations = relations(user, ({ many, one }) => ({
  accounts: many(account),
  sessions: many(session),
  packageFollows: many(packageFollow),
  releaseFollows: many(releaseFollow),
  submittedReleases: many(upcomingRelease),
  notifications: many(notification),
  notificationPreferences: one(notificationPreferences),
}));

export const packageFollowRelations = relations(packageFollow, ({ one }) => ({
  user: one(user, {
    fields: [packageFollow.userId],
    references: [user.id],
  }),
}));

export const upcomingReleaseRelations = relations(upcomingRelease, ({ one, many }) => ({
  submittedBy: one(user, {
    fields: [upcomingRelease.submittedById],
    references: [user.id],
  }),
  followers: many(releaseFollow),
}));

export const releaseFollowRelations = relations(releaseFollow, ({ one }) => ({
  user: one(user, {
    fields: [releaseFollow.userId],
    references: [user.id],
  }),
  release: one(upcomingRelease, {
    fields: [releaseFollow.releaseId],
    references: [upcomingRelease.id],
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
