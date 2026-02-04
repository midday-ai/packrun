/**
 * Search API Tests
 */

import { describe, expect, test } from "bun:test";
import { request } from "./helpers";

describe("Search API", () => {
  test("GET /search?q= returns paginated results", async () => {
    const res = await request("/search?q=react&limit=5");
    expect(res.status).toBe(200);

    const data = (await res.json()) as {
      hits: Array<{ name: string }>;
      found: number;
      page: number;
    };
    expect(data.hits.length).toBeGreaterThan(0);
    expect(data.found).toBeGreaterThan(0);
    expect(data.page).toBeDefined();
  });
});
