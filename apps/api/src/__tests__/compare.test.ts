/**
 * Compare API Tests
 */

import { describe, expect, test } from "bun:test";
import { request } from "./helpers";

describe("Compare API", () => {
  test("GET /api/compare?packages= compares multiple packages", async () => {
    const res = await request("/api/compare?packages=react,vue");
    expect(res.status).toBe(200);

    const data = (await res.json()) as { packages: Array<{ name: string }> };
    expect(data.packages).toHaveLength(2);
    expect(data.packages.map((p) => p.name)).toContain("react");
    expect(data.packages.map((p) => p.name)).toContain("vue");
  });

  test("GET /api/compare?list=categories returns all categories", async () => {
    const res = await request("/api/compare?list=categories");
    expect(res.status).toBe(200);

    const data = (await res.json()) as { categories: Array<{ id: string; name: string }> };
    expect(data.categories.length).toBeGreaterThan(0);
    expect(data.categories[0]).toHaveProperty("id");
    expect(data.categories[0]).toHaveProperty("name");
  });
});
