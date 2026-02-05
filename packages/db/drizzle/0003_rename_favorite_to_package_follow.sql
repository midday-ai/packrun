-- Rename favorite table to package_follow
ALTER TABLE "favorite" RENAME TO "package_follow";--> statement-breakpoint

-- Rename indexes
ALTER INDEX "favorite_userId_idx" RENAME TO "packageFollow_userId_idx";--> statement-breakpoint
ALTER INDEX "favorite_packageName_idx" RENAME TO "packageFollow_packageName_idx";--> statement-breakpoint
ALTER INDEX "favorite_unique" RENAME TO "packageFollow_unique";--> statement-breakpoint

-- Rename foreign key constraint
ALTER TABLE "package_follow" RENAME CONSTRAINT "favorite_user_id_user_id_fk" TO "package_follow_user_id_user_id_fk";
