/**
 * Better Auth Configuration
 *
 * Authentication with GitHub OAuth, Drizzle ORM.
 * Uses cookieCache for fast session lookups (no LRU cache needed).
 */

import { db } from "@packrun/db/client";
import * as schema from "@packrun/db/schema";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

const isProduction =
  process.env.BETTER_AUTH_URL?.includes("v1.run") ||
  process.env.BETTER_AUTH_URL?.includes("packrun.dev");

// Only initialize auth if database is available
export const auth = db
  ? betterAuth({
      baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3001",
      basePath: "/v1/auth",
      database: drizzleAdapter(db, { provider: "pg", schema }),
      trustedOrigins: [
        "http://localhost:3000",
        "https://packrun.dev",
        "https://www.packrun.dev",
        "https://v1.run",
        "https://www.v1.run",
      ],

      socialProviders: {
        github: {
          clientId: process.env.GITHUB_CLIENT_ID!,
          clientSecret: process.env.GITHUB_CLIENT_SECRET!,
          redirectURI: process.env.BETTER_AUTH_URL
            ? `${process.env.BETTER_AUTH_URL}/v1/auth/callback/github`
            : "http://localhost:3001/v1/auth/callback/github",
        },
      },

      // Session and cookie configuration
      // CookieCache handles fast session validation from cookies (no LRU cache needed)
      session: {
        expiresIn: 60 * 60 * 24 * 90, // 90 days (3 months - long-lived sessions)
        updateAge: 60 * 60 * 24 * 7, // Refresh session expiration after 7 days of activity
        storeSessionInDatabase: true, // Store in DB, validate from cookies
        cookieCache: {
          enabled: true,
          maxAge: 60 * 60 * 24, // 24 hours (cookie cache duration)
          // Session validation happens from cookies (fast, no DB query)
          // Only queries DB when cookie cache expires or session is revoked
        },
      },

      // Cross-subdomain cookies only in production (requires HTTPS)
      advanced: isProduction
        ? {
            crossSubDomainCookies: {
              enabled: true,
              domain: process.env.BETTER_AUTH_URL?.includes("v1.run") ? ".v1.run" : ".packrun.dev",
            },
            defaultCookieAttributes: {
              secure: true,
              sameSite: "none", // Required for cross-origin requests
            },
          }
        : undefined,
    })
  : null;
