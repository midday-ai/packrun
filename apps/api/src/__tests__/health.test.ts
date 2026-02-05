/**
 * Health Check Tests
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
