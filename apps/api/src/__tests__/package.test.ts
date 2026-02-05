/**
 * Package API Tests
 */

import { describe, expect, test } from "bun:test";
import { request } from "./helpers";

describe("Package API", () => {
  test("GET /v1/package/:name returns package with health data", async () => {
    const res = await request("/v1/package/lodash");
    expect(res.status).toBe(200);

    const data = (await res.json()) as {
      name: string;
      version: string;
      description: string;
      health: { score: number; grade: string };
    };
    expect(data.name).toBe("lodash");
    expect(data.version).toBeDefined();
    expect(data.description).toBeDefined();
    expect(data.health.score).toBeGreaterThan(0);
    expect(data.health.grade).toMatch(/^[A-F]$/);
  });

  test("GET /v1/package/:name returns 404 for unknown package", async () => {
    const res = await request("/v1/package/this-package-definitely-does-not-exist-xyz-123");
    expect(res.status).toBe(404);
  });

  test("GET /v1/package/:name/downloads returns weekly history", async () => {
    const res = await request("/v1/package/react/downloads");
    expect(res.status).toBe(200);

    const data = (await res.json()) as {
      package: string;
      weeks: Array<{ start: string; end: string; downloads: number }>;
    };
    expect(data.package).toBe("react");
    expect(data.weeks.length).toBeGreaterThan(0);
    expect(data.weeks[0]).toHaveProperty("downloads");
  });
});
