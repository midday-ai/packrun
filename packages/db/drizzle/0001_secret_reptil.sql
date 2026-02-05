CREATE TABLE "integration_connection" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"display_name" text NOT NULL,
	"config" jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"package_name" text NOT NULL,
	"new_version" text NOT NULL,
	"previous_version" text,
	"severity" text DEFAULT 'info' NOT NULL,
	"is_security_update" boolean DEFAULT false NOT NULL,
	"is_breaking_change" boolean DEFAULT false NOT NULL,
	"changelog_snippet" text,
	"vulnerabilities_fixed" integer,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"notify_all_updates" boolean DEFAULT false NOT NULL,
	"notify_major_only" boolean DEFAULT true NOT NULL,
	"notify_security_only" boolean DEFAULT true NOT NULL,
	"in_app_enabled" boolean DEFAULT true NOT NULL,
	"slack_enabled" boolean DEFAULT false NOT NULL,
	"email_digest_enabled" boolean DEFAULT false NOT NULL,
	"email_digest_frequency" text DEFAULT 'daily',
	"email_immediate_critical" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "notification_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "integration_connection" ADD CONSTRAINT "integration_connection_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "integration_userId_idx" ON "integration_connection" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "integration_userId_provider_idx" ON "integration_connection" USING btree ("user_id","provider");--> statement-breakpoint
CREATE INDEX "notification_userId_idx" ON "notification" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notification_userId_read_idx" ON "notification" USING btree ("user_id","read");--> statement-breakpoint
CREATE INDEX "notification_userId_severity_idx" ON "notification" USING btree ("user_id","severity");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_unique" ON "notification" USING btree ("user_id","package_name","new_version");