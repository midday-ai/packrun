-- Create upcoming_release table
CREATE TABLE "upcoming_release" (
  "id" text PRIMARY KEY NOT NULL,
  "package_name" text,
  "title" text NOT NULL,
  "description" text,
  "target_version" text NOT NULL,
  "version_match_type" text DEFAULT 'exact' NOT NULL,
  "released_version" text,
  "released_at" timestamp,
  "status" text DEFAULT 'upcoming' NOT NULL,
  "logo_url" text,
  "website_url" text,
  "expected_date" timestamp,
  "submitted_by_id" text NOT NULL,
  "featured" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

-- Create release_follow table
CREATE TABLE "release_follow" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "release_id" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

-- Add foreign key constraints
ALTER TABLE "upcoming_release" ADD CONSTRAINT "upcoming_release_submitted_by_id_user_id_fk" FOREIGN KEY ("submitted_by_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_follow" ADD CONSTRAINT "release_follow_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_follow" ADD CONSTRAINT "release_follow_release_id_upcoming_release_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."upcoming_release"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- Create indexes for upcoming_release
CREATE INDEX "upcomingRelease_packageName_idx" ON "upcoming_release" USING btree ("package_name");--> statement-breakpoint
CREATE INDEX "upcomingRelease_status_idx" ON "upcoming_release" USING btree ("status");--> statement-breakpoint
CREATE INDEX "upcomingRelease_packageStatus_idx" ON "upcoming_release" USING btree ("package_name", "status");--> statement-breakpoint
CREATE INDEX "upcomingRelease_submittedBy_idx" ON "upcoming_release" USING btree ("submitted_by_id");--> statement-breakpoint
CREATE INDEX "upcomingRelease_featured_idx" ON "upcoming_release" USING btree ("featured");--> statement-breakpoint

-- Create indexes for release_follow
CREATE INDEX "releaseFollow_userId_idx" ON "release_follow" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "releaseFollow_releaseId_idx" ON "release_follow" USING btree ("release_id");--> statement-breakpoint
CREATE UNIQUE INDEX "releaseFollow_unique" ON "release_follow" USING btree ("user_id", "release_id");
