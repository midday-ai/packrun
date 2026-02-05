/**
 * QueryClient Factory
 *
 * Creates a QueryClient configured for oRPC with proper serialization
 * to support SSR hydration of complex data types.
 */

import { StandardRPCJsonSerializer } from "@orpc/client/standard";
import { defaultShouldDehydrateQuery, QueryClient } from "@tanstack/react-query";

const serializer = new StandardRPCJsonSerializer();

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Use oRPC serializer for query key hashing to handle complex types
        queryKeyHashFn(queryKey) {
          const [json, meta] = serializer.serialize(queryKey);
          return JSON.stringify({ json, meta });
        },
        // Prevent immediate refetching on mount after hydration
        staleTime: 60 * 1000, // 1 minute
        gcTime: 5 * 60 * 1000, // 5 minutes
      },
      dehydrate: {
        // Also dehydrate pending queries for streaming SSR
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) || query.state.status === "pending",
        // Serialize data for hydration
        serializeData(data) {
          const [json, meta] = serializer.serialize(data);
          return { json, meta };
        },
      },
      hydrate: {
        // Deserialize data from hydration
        deserializeData(data: { json: unknown; meta: unknown }) {
          return serializer.deserialize(
            data.json,
            data.meta as Parameters<typeof serializer.deserialize>[1],
          );
        },
      },
    },
  });
}
