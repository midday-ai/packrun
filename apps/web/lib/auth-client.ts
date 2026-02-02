/**
 * Better Auth Client
 *
 * Client-side authentication hooks and utilities
 */

import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001",
  basePath: "/api/auth",
  fetchOptions: {
    credentials: "include", // Send cookies with cross-origin requests
  },
});

export const { useSession, signIn, signOut } = authClient;
