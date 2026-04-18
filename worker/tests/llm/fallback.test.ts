import { describe, it, expect, vi } from "vitest";
import { FallbackLLM, type FallbackEntry } from "../../src/llm/fallback.js";
import type { LLMAdapter, LLMResponse } from "../../src/llm/adapter.js";

function mockAdapter(result: LLMResponse | Error, calls?: { count: number }): LLMAdapter {
  return {
    complete: vi.fn().mockImplementation(async () => {
      if (calls) calls.count += 1;
      if (result instanceof Error) throw result;
      return result;
    }),
  };
}

function ok(model: string, text = "ok"): LLMResponse {
  return { text, model, usage: { inputTokens: 10, outputTokens: 20 } };
}

function entry(
  providerType: string,
  baseURL: string | undefined,
  model: string,
  adapter: LLMAdapter,
): FallbackEntry {
  return { providerType, baseURL, model, adapter };
}

describe("FallbackLLM", () => {
  it("throws immediately when constructed with no entries", () => {
    expect(() => new FallbackLLM([])).toThrow(/at least one entry/);
  });

  it("single entry success returns its response directly", async () => {
    const llm = new FallbackLLM([
      entry("openai_compatible", "https://a.test/v1", "qwen3.6-plus", mockAdapter(ok("qwen3.6-plus"))),
    ]);
    const r = await llm.complete({ system: "s", prompt: "p" });
    expect(r.model).toBe("qwen3.6-plus");
    expect(r.text).toBe("ok");
  });

  it("falls through to next entry on 429 and returns fallback response", async () => {
    const primary = mockAdapter(new Error("Too Many Requests (429)"));
    const secondary = mockAdapter(ok("qwen3.6-plus"));
    const llm = new FallbackLLM([
      entry("openai_compatible", "https://a.test/v1", "qwen3.6-plus", primary),
      entry("openai_compatible", "https://a.test/v1", "qwen3.6-plus", secondary),
    ]);
    const r = await llm.complete({ system: "s", prompt: "p" });
    expect(r.model).toBe("qwen3.6-plus");
    expect(primary.complete).toHaveBeenCalledOnce();
    expect(secondary.complete).toHaveBeenCalledOnce();
  });

  it("falls through across providers (openai_compatible → anthropic)", async () => {
    const glm = mockAdapter(new Error("AllocationQuota exhausted"));
    const claude = mockAdapter(ok("claude-sonnet-4-6"));
    const llm = new FallbackLLM([
      entry("openai_compatible", "https://dashscope.test/v1", "glm-5", glm),
      entry("anthropic", undefined, "claude-sonnet-4-6", claude),
    ]);
    const r = await llm.complete({ system: "s", prompt: "p" });
    expect(r.model).toBe("claude-sonnet-4-6");
  });

  it("blocks permanently-failed entries across subsequent calls", async () => {
    const primary = mockAdapter(new Error("Not Found (404) — model qwen-missing"));
    const secondary = mockAdapter(ok("qwen3.6-plus"));
    const llm = new FallbackLLM([
      entry("openai_compatible", "https://a.test/v1", "qwen-missing", primary),
      entry("openai_compatible", "https://a.test/v1", "qwen3.6-plus", secondary),
    ]);

    await llm.complete({ system: "s", prompt: "p" });
    await llm.complete({ system: "s", prompt: "p" });

    expect(primary.complete).toHaveBeenCalledOnce();
    expect(secondary.complete).toHaveBeenCalledTimes(2);
  });

  it("compound key prevents false blocking when model repeats on different provider+url", async () => {
    // Same model string, different provider+baseURL — permanent block on one
    // entry must NOT silently block the other.
    const blocked = mockAdapter(new Error("Unauthorized (401)"));
    const fine = mockAdapter(ok("claude-sonnet-4-6"));
    const llm = new FallbackLLM([
      entry("anthropic", undefined, "claude-sonnet-4-6", blocked),
      entry("openai_compatible", "https://proxy.test/v1", "claude-sonnet-4-6", fine),
    ]);

    const r = await llm.complete({ system: "s", prompt: "p" });
    expect(r.text).toBe("ok");

    // Second call: the anthropic entry is blocked, but the openai_compatible
    // one with the same model name is not. It still succeeds.
    const r2 = await llm.complete({ system: "s", prompt: "p" });
    expect(r2.text).toBe("ok");
    expect(blocked.complete).toHaveBeenCalledOnce();
    expect(fine.complete).toHaveBeenCalledTimes(2);
  });

  it("rethrows non-fallbackable error without trying the next entry", async () => {
    const primary = mockAdapter(new Error("JSON parse error in response"));
    const secondary = mockAdapter(ok("qwen3.6-plus"));
    const llm = new FallbackLLM([
      entry("openai_compatible", "https://a.test/v1", "qwen3.6-plus", primary),
      entry("openai_compatible", "https://a.test/v1", "qwen-plus", secondary),
    ]);

    await expect(llm.complete({ system: "s", prompt: "p" })).rejects.toThrow(/JSON parse/);
    expect(secondary.complete).not.toHaveBeenCalled();
  });

  it("throws aggregated error when all entries are blocked", async () => {
    const a = mockAdapter(new Error("Unauthorized (401)"));
    const b = mockAdapter(new Error("Forbidden (403)"));
    const llm = new FallbackLLM([
      entry("openai_compatible", "https://a.test/v1", "a", a),
      entry("anthropic", undefined, "b", b),
    ]);

    // First call exhausts both entries with permanent errors.
    await expect(llm.complete({ system: "s", prompt: "p" })).rejects.toThrow();

    // Second call: both blocked, so we fail fast with the "all blocked" message
    // rather than calling either adapter again.
    await expect(llm.complete({ system: "s", prompt: "p" })).rejects.toThrow(/All fallback entries blocked/);
    expect(a.complete).toHaveBeenCalledOnce();
    expect(b.complete).toHaveBeenCalledOnce();
  });

  it("rethrows last error when fallback exhausted", async () => {
    const primary = mockAdapter(new Error("Internal Server Error (500)"));
    const secondary = mockAdapter(new Error("Service Unavailable (503)"));
    const llm = new FallbackLLM([
      entry("openai_compatible", "https://a.test/v1", "a", primary),
      entry("openai_compatible", "https://a.test/v1", "b", secondary),
    ]);

    // Both 5xx are fallbackable but not permanent, so both run and the final
    // error bubbles up without blocking either entry.
    await expect(llm.complete({ system: "s", prompt: "p" })).rejects.toThrow(/503/);

    // Second call: neither is blocked (5xx is transient), so both are retried.
    await expect(llm.complete({ system: "s", prompt: "p" })).rejects.toThrow();
    expect(primary.complete).toHaveBeenCalledTimes(2);
    expect(secondary.complete).toHaveBeenCalledTimes(2);
  });
});
