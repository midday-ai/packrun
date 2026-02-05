/**
 * Database Client
 *
 * Shared PostgreSQL connection using Drizzle ORM.
 */

import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;

/**
 * Create a database connection
 */
export function createDb(connectionString?: string): Database | null {
  const url = connectionString || process.env.DATABASE_URL;

  if (!url) {
    console.warn("[DB] DATABASE_URL not set - database features will be disabled");
    return null;
  }

  const client = postgres(url);
  return drizzle(client, { schema });
}

/**
 * Type guard to check if database is available
 */
export function isDatabaseAvailable(db: Database | null): db is Database {
  return db !== null;
}

/**
 * Default database instance (uses DATABASE_URL from environment)
 */
export const db = createDb();
