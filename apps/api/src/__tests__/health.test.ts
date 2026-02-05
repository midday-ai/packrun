/**
 * Health Check and OpenAPI Tests
 */

import { describe, expect, test } from "bun:test";
import { request } from "./helpers";

describe("Health Check", () => {
  test("GET /health returns healthy status", async () => {
    const res = await request("/health");
    expect(res.status).toBe(200);

    const data = (await res.json()) as { status: string; service: string; timestamp: string };
    expect(data.status).toBe("healthy");
    expect(data.service).toBe("packrun-api");
    expect(data.timestamp).toBeDefined();
  });
});

describe("OpenAPI", () => {
  test("GET /openapi.json returns valid spec", async () => {
    const res = await request("/openapi.json");
    expect(res.status).toBe(200);

    const data = (await res.json()) as { openapi: string; info: { title: string }; paths: unknown };
    expect(data.openapi).toBe("3.1.0");
    expect(data.info.title).toBe("packrun.dev API");
    expect(data.paths).toBeDefined();
  });

  test("GET /docs returns HTML documentation", async () => {
    const res = await request("/docs");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
  });
});
