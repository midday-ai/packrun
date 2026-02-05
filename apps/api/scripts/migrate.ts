/**
 * Database Migration Script
 *
 * Run with: bun run scripts/migrate.ts
 * Used for production deployments to apply pending migrations
 */

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("[Migrate] DATABASE_URL is required");
  process.exit(1);
}

const client = postgres(connectionString, { max: 1 });
const db = drizzle(client);

console.log("[Migrate] Running migrations...");

try {
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("[Migrate] Migrations complete");
} catch (error) {
  console.error("[Migrate] Migration failed:", error);
  process.exit(1);
} finally {
  await client.end();
}
