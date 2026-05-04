import { describe, it, expect, vi } from "vitest";
import { completeWithTruncationRetry, completeAndParseJson } from "../../src/utils/llm-helpers.js";
import { LLMTruncatedError, type LLMAdapter } from "../../src/llm/adapter.js";

const mockResponse = (text: string, model = "mock") => ({
  text,
  model,
  usage: { inputTokens: 100, outputTokens: 200 },
});

describe("completeWithTruncationRetry", () => {
  it("returns response on first success", async () => {
    const complete = vi.fn().mockResolvedValue(mockResponse("ok"));
    const llm: LLMAdapter = { complete };
    const out = await completeWithTruncationRetry(
      llm,
      { system: "s", prompt: "p" },
      "ctx",
      { base: 1000, retry: 2000 },
    );
    expect(out.text).toBe("ok");
    expect(complete).toHaveBeenCalledTimes(1);
    expect(complete.mock.calls[0][0].maxTokens).toBe(1000);
  });

  it("retries with bumped budget on truncation, then succeeds", async () => {
    const complete = vi
      .fn()
      .mockRejectedValueOnce(new LLMTruncatedError("openai_compatible", "m", 1000, "partial"))
      .mockResolvedValue(mockResponse("recovered"));
    const llm: LLMAdapter = { complete };
    const out = await completeWithTruncationRetry(
      llm,
      { system: "s", prompt: "p" },
      "ctx",
      { base: 1000, retry: 2000 },
    );
    expect(out.text).toBe("recovered");
    expect(complete.mock.calls[0][0].maxTokens).toBe(1000);
    expect(complete.mock.calls[1][0].maxTokens).toBe(2000);
  });

  it("throws split-required error when retry also truncates", async () => {
    const complete = vi
      .fn()
      .mockRejectedValue(new LLMTruncatedError("openai_compatible", "m", 2000, "partial"));
    const llm: LLMAdapter = { complete };
    await expect(
      completeWithTruncationRetry(llm, { system: "s", prompt: "p" }, "ctx", { base: 1000, retry: 2000 }),
    ).rejects.toThrow(/Output exceeds gateway\/model max/);
  });

  it("surfaces HTTP 4xx as 'provider rejected' rather than generic error", async () => {
    const complete = vi
      .fn()
      .mockRejectedValueOnce(new LLMTruncatedError("openai_compatible", "m", 1000, ""))
      .mockRejectedValue(new Error("LLM API error (400): max_tokens exceeds limit"));
    const llm: LLMAdapter = { complete };
    await expect(
      completeWithTruncationRetry(llm, { system: "s", prompt: "p" }, "ctx", { base: 1000, retry: 16384 }),
    ).rejects.toThrow(/Provider rejected max_tokens=16384.*HTTP 4xx/);
  });

  it("does not catch non-truncation errors", async () => {
    const complete = vi.fn().mockRejectedValue(new Error("network down"));
    const llm: LLMAdapter = { complete };
    await expect(
      completeWithTruncationRetry(llm, { system: "s", prompt: "p" }, "ctx", { base: 1000, retry: 2000 }),
    ).rejects.toThrow("network down");
    expect(complete).toHaveBeenCalledTimes(1);
  });
});

describe("completeAndParseJson", () => {
  it("parses valid JSON on first try", async () => {
    const complete = vi.fn().mockResolvedValue(mockResponse('{"score": 7}'));
    const llm: LLMAdapter = { complete };
    const out = await completeAndParseJson<{ score: number }>(
      llm,
      { system: "s", prompt: "p" },
      "ctx",
      { base: 1000, retry: 2000 },
    );
    expect(out.score).toBe(7);
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it("retries with strict-JSON instruction when first parse fails", async () => {
    // Garbage that even robustJsonParse can't recover (single-quoted keys).
    const complete = vi
      .fn()
      .mockResolvedValueOnce(mockResponse("{'score': 'not json'"))
      .mockResolvedValue(mockResponse('{"score": 7}'));
    const llm: LLMAdapter = { complete };
    const out = await completeAndParseJson<{ score: number }>(
      llm,
      { system: "s", prompt: "original prompt" },
      "ctx",
      { base: 1000, retry: 2000 },
    );
    expect(out.score).toBe(7);
    expect(complete).toHaveBeenCalledTimes(2);
    const retryPrompt = complete.mock.calls[1][0].prompt as string;
    expect(retryPrompt).toContain("INVALID JSON");
    expect(retryPrompt).toContain("straight ASCII double quotes");
  });

  it("throws after retry also fails to parse", async () => {
    const complete = vi.fn().mockResolvedValue(mockResponse("not json at all"));
    const llm: LLMAdapter = { complete };
    await expect(
      completeAndParseJson(llm, { system: "s", prompt: "p" }, "ctx", { base: 1000, retry: 2000 }),
    ).rejects.toThrow(/JSON parse failed after retry/);
    expect(complete).toHaveBeenCalledTimes(2);
  });
});
