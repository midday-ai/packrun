import * as Sentry from "@sentry/nextjs";
import { setupAnalytics } from "@v1/analytics/server";
import { ratelimit } from "@v1/kv/ratelimit";
import { logger } from "@v1/logger";
import { adminAuth } from "@v1/functions/src/admin";
import {
  DEFAULT_SERVER_ERROR_MESSAGE,
  createSafeActionClient,
} from "next-safe-action";
import { headers, cookies } from "next/headers";
import { z } from "zod";

const handleServerError = (e: Error) => {
  console.error("Action error:", e.message);

  if (e instanceof Error) {
    return e.message;
  }

  return DEFAULT_SERVER_ERROR_MESSAGE;
};

export const actionClient = createSafeActionClient({
  handleServerError,
});

export const actionClientWithMeta = createSafeActionClient({
  handleServerError,
  defineMetadataSchema() {
    return z.object({
      name: z.string(),
      track: z
        .object({
          event: z.string(),
          channel: z.string(),
        })
        .optional(),
    });
  },
});

export const authActionClient = actionClientWithMeta
  .use(async ({ next, clientInput, metadata }) => {
    const result = await next({ ctx: {} });

    if (process.env.NODE_ENV === "development") {
      logger.info(`Input -> ${JSON.stringify(clientInput)}`);
      logger.info(`Result -> ${JSON.stringify(result.data)}`);
      logger.info(`Metadata -> ${JSON.stringify(metadata)}`);

      return result;
    }

    return result;
  })
  .use(async ({ next, metadata }) => {
    const ip = headers().get("x-forwarded-for");

    const { success, remaining } = await ratelimit.limit(
      `${ip}-${metadata.name}`,
    );

    if (!success) {
      throw new Error("Too many requests");
    }

    return next({
      ctx: {
        ratelimit: {
          remaining,
        },
      },
    });
  })
  .use(async ({ next, metadata }) => {
    const sessionCookie = cookies().get("session")?.value;
    if (!sessionCookie) {
      throw new Error("Unauthorized: No session cookie");
    }

    const decodedToken = await adminAuth.verifySessionCookie(sessionCookie, true);

    if (!decodedToken) {
      throw new Error("Unauthorized: Invalid session cookie");
    }

    if (metadata.track) {
      const analytics = await setupAnalytics({
        userId: decodedToken.uid,
      });
      analytics.track(metadata.track);
    }

    return Sentry.withServerActionInstrumentation(metadata.name, async () => {
      return next({
        ctx: {
          user: decodedToken,
        },
      });
    });
  });
