/**
 * oRPC TanStack Query Utilities
 *
 * Provides type-safe query options for use with useQuery, useMutation, etc.
 */

import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { client } from "./client";

export const orpc = createTanstackQueryUtils(client);
