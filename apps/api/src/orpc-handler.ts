/**
 * oRPC Handler Setup
 *
 * Sets up the oRPC handlers for both RPC and OpenAPI protocols.
 * The RPC endpoint is used by the web app for type-safe calls.
 * The OpenAPI endpoint is for external REST consumers.
 */

import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { RPCHandler } from "@orpc/server/fetch";
import { CORSPlugin } from "@orpc/server/plugins";
import { ZodSmartCoercionPlugin } from "@orpc/zod";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context, User } from "@packrun/api";
import { auth } from "./lib/auth";
import { type AppRouter, appRouter, publicRouter } from "./procedures";

/**
 * Create context from incoming request
 *
 * Extracts headers and user session for use in procedures.
 */
export async function createContext(request: Request): Promise<Context> {
  let user: User | null = null;

  // Get session from auth if available
  if (auth) {
    try {
      const session = await auth.api.getSession({ headers: request.headers });
      if (session?.user) {
        user = {
          id: session.user.id,
          name: session.user.name,
          email: session.user.email,
          image: session.user.image,
        };
      }
    } catch {
      // Session fetch failed, user remains null
    }
  }

  return {
    headers: request.headers,
    user,
  };
}

/**
 * CORS configuration for oRPC handlers
 */
const corsPlugin = new CORSPlugin({
  origin: (origin) => {
    if (!origin) return "*";
    if (origin.includes("localhost")) return origin;
    if (origin.endsWith(".packrun.dev")) return origin;
    if (origin === "https://packrun.dev") return origin;
    return "*";
  },
  allowMethods: ["GET", "HEAD", "PUT", "POST", "DELETE", "PATCH", "OPTIONS"],
  allowHeaders: ["Content-Type", "Cache-Control", "Authorization"],
  credentials: true,
  maxAge: 86400,
});

/**
 * OpenAPI Reference Plugin for docs UI and spec
 */
const openAPIReferencePlugin = new OpenAPIReferencePlugin({
  docsPath: "/docs",
  specPath: "/openapi.json",
  schemaConverters: [new ZodToJsonSchemaConverter()],
  specGenerateOptions: {
    info: {
      title: "packrun.dev API",
      version: "1.0.0",
      description: "npm package health, security, and comparison API",
    },
    servers: [
      { url: "https://api.packrun.dev", description: "Production" },
      { url: "http://localhost:3001", description: "Development" },
    ],
  },
});

/**
 * RPC Handler for type-safe internal clients
 */
export const rpcHandler = new RPCHandler(appRouter, {
  plugins: [corsPlugin, new ZodSmartCoercionPlugin()],
});

/**
 * OpenAPI Handler for REST consumers (includes docs plugin)
 * Uses publicRouter to exclude admin routes from documentation
 */
export const openApiHandler = new OpenAPIHandler(publicRouter, {
  plugins: [corsPlugin, new ZodSmartCoercionPlugin(), openAPIReferencePlugin],
});

/**
 * Handle RPC requests (type-safe internal clients)
 */
export async function handleRPC(request: Request): Promise<Response | null> {
  const context = await createContext(request);

  const rpc = await rpcHandler.handle(request, {
    prefix: "/rpc",
    context,
  });

  if (rpc.matched) {
    return rpc.response;
  }

  return null;
}

/**
 * Handle OpenAPI requests (REST consumers)
 * Also serves /docs and /openapi.json via the OpenAPIReferencePlugin
 */
export async function handleOpenAPI(request: Request): Promise<Response | null> {
  const context = await createContext(request);

  const api = await openApiHandler.handle(request, {
    prefix: "/",
    context,
  });

  if (api.matched) {
    return api.response;
  }

  return null;
}

// Re-export the router type for client usage
export type { AppRouter };
