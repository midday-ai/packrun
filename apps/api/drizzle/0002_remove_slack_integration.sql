-- Drop the slack_enabled column from notification_preferences
ALTER TABLE "notification_preferences" DROP COLUMN IF EXISTS "slack_enabled";

-- Drop the integration_connection table
DROP TABLE IF EXISTS "integration_connection";
