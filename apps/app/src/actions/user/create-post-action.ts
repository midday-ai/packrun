"use server";

import { authActionClient } from "@/actions/safe-action";
import { adminDb } from "@v1/functions/src/admin";
import { z } from "zod";

export const createPostAction = authActionClient
  .metadata({
    name: "createPost",
  })
  .action({
    input: z.object({
      text: z.string().min(1).max(280),
    }),
    ctx: z.object({
      user: z.object({
        uid: z.string(),
      }),
    }),
    handler: async ({ input, ctx }) => {
      const { text } = input;
      const { uid } = ctx.user;

      const post = {
        text,
        userId: uid,
        createdAt: new Date(),
      };

      await adminDb.collection("posts").add(post);

      return { success: true, post };
    },
  });
