import { describe, it, expect, beforeEach, afterEach } from "vitest";

const ORIGINAL_URL = process.env.UPSTASH_REDIS_REST_URL;
const ORIGINAL_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

beforeEach(() => {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
});

afterEach(() => {
  if (ORIGINAL_URL) process.env.UPSTASH_REDIS_REST_URL = ORIGINAL_URL;
  if (ORIGINAL_TOKEN) process.env.UPSTASH_REDIS_REST_TOKEN = ORIGINAL_TOKEN;
});

describe("enforceRateLimit", () => {
  it("returns null when redis env not configured (fail-open)", async () => {
    const { enforceRateLimit } = await import("@/lib/rate-limit");
    const result = await enforceRateLimit("personas", "user-abc");
    expect(result).toBeNull();
  });

  it("allows all four limiter keys", async () => {
    const { enforceRateLimit } = await import("@/lib/rate-limit");
    const keys = ["evaluations", "personas", "debateMessages", "llmSettings"] as const;
    for (const k of keys) {
      const result = await enforceRateLimit(k, "user-abc");
      expect(result).toBeNull();
    }
  });
});
