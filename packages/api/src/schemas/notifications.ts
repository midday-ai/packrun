/**
 * Notifications Schemas
 *
 * Zod schemas for notifications-related API responses.
 */

import { z } from "zod";

// =============================================================================
// Notifications
// =============================================================================

export const NotificationSchema = z.object({
  id: z.string(),
  packageName: z.string(),
  newVersion: z.string(),
  previousVersion: z.string().nullable(),
  severity: z.enum(["critical", "important", "info"]),
  isSecurityUpdate: z.boolean(),
  isBreakingChange: z.boolean(),
  changelogSnippet: z.string().nullable(),
  vulnerabilitiesFixed: z.number().nullable(),
  read: z.boolean(),
  createdAt: z.string(),
});

export const NotificationsListResponseSchema = z.object({
  notifications: z.array(NotificationSchema),
  total: z.number(),
  unreadCount: z.number(),
});

export const UnreadCountResponseSchema = z.object({
  total: z.number(),
  critical: z.number(),
});

// =============================================================================
// Notification Preferences
// =============================================================================

export const NotificationPreferencesSchema = z.object({
  notifyAllUpdates: z.boolean(),
  notifyMajorOnly: z.boolean(),
  notifySecurityOnly: z.boolean(),
  inAppEnabled: z.boolean(),
  emailDigestEnabled: z.boolean(),
  emailDigestFrequency: z.enum(["daily", "weekly"]).nullable(),
  emailImmediateCritical: z.boolean(),
});

export const NotificationPreferencesResponseSchema = z.object({
  preferences: NotificationPreferencesSchema,
});

// Type exports
export type Notification = z.infer<typeof NotificationSchema>;
export type NotificationsListResponse = z.infer<typeof NotificationsListResponseSchema>;
export type UnreadCountResponse = z.infer<typeof UnreadCountResponseSchema>;
export type NotificationPreferences = z.infer<typeof NotificationPreferencesSchema>;
