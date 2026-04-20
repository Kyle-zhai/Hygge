import { describe, it, expect, vi } from "vitest";
import { OpenAICompatibleLLM } from "../../src/llm/openai-compatible.js";
import { AnthropicLLM } from "../../src/llm/anthropic.js";
import { GoogleLLM } from "../../src/llm/google.js";
import { LLMTruncatedError } from "../../src/llm/adapter.js";

describe("LLM Adapter", () => {
  it("OpenAICompatibleLLM implements LLMAdapter interface", () => {
    const llm = new OpenAICompatibleLLM("fake-key", "qwen3.6-plus", "https://dashscope.aliyuncs.com/compatible-mode/v1");
    expect(llm).toHaveProperty("complete");
    expect(typeof llm.complete).toBe("function");
  });

  it("OpenAICompatibleLLM.complete calls API with correct params", async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        choices: [{ message: { content: '{"result": "test"}' } }],
        usage: { prompt_tokens: 100, completion_tokens: 50 },
      }),
    };
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse as any);

    const llm = new OpenAICompatibleLLM("fake-key", "qwen3.6-plus", "https://dashscope.aliyuncs.com/compatible-mode/v1");

    const result = await llm.complete({
      system: "You are a helpful assistant.",
      prompt: "Say hello",
      maxTokens: 1000,
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
      expect.objectContaining({ method: "POST" })
    );

    expect(result.text).toBe('{"result": "test"}');
    expect(result.model).toBe("qwen3.6-plus");
    expect(result.usage).toEqual({ inputTokens: 100, outputTokens: 50 });

    fetchSpy.mockRestore();
  });

  it("passes an AbortSignal to fetch so slow providers can't hang the worker", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ choices: [{ message: { content: "ok" } }], usage: {} }),
        { status: 200 },
      ),
    );
    const llm = new OpenAICompatibleLLM("k", "qwen3.6-plus", "https://example.com/v1");
    await llm.complete({ system: "s", prompt: "p" });
    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
    fetchSpy.mockRestore();
  });

  it("OpenAICompatibleLLM throws LLMTruncatedError when finish_reason='length'", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '{"a":1' }, finish_reason: "length" }],
          usage: { prompt_tokens: 10, completion_tokens: 4096 },
        }),
        { status: 200 },
      ),
    );
    const llm = new OpenAICompatibleLLM("k", "qwen3.6-plus", "https://example.com/v1");
    const err = await llm.complete({ system: "s", prompt: "p", maxTokens: 4096 }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(LLMTruncatedError);
    expect((err as LLMTruncatedError).provider).toBe("openai_compatible");
    expect((err as LLMTruncatedError).outputTokens).toBe(4096);
    fetchSpy.mockRestore();
  });

  it("AnthropicLLM throws LLMTruncatedError when stop_reason='max_tokens'", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          content: [{ type: "text", text: '{"a":1' }],
          usage: { input_tokens: 10, output_tokens: 4096 },
          stop_reason: "max_tokens",
        }),
        { status: 200 },
      ),
    );
    const llm = new AnthropicLLM("k", "claude-opus-4-7");
    const err = await llm.complete({ system: "s", prompt: "p", maxTokens: 4096 }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(LLMTruncatedError);
    expect((err as LLMTruncatedError).provider).toBe("anthropic");
    fetchSpy.mockRestore();
  });

  it("GoogleLLM throws LLMTruncatedError when finishReason='MAX_TOKENS'", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: { parts: [{ text: '{"a":1' }] },
              finishReason: "MAX_TOKENS",
            },
          ],
          usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 4096 },
        }),
        { status: 200 },
      ),
    );
    const llm = new GoogleLLM("k", "gemini-2.0-flash");
    const err = await llm.complete({ system: "s", prompt: "p", maxTokens: 4096 }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(LLMTruncatedError);
    expect((err as LLMTruncatedError).provider).toBe("google");
    fetchSpy.mockRestore();
  });

  it("OpenAICompatibleLLM does NOT throw when finish_reason='stop'", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '{"a":1}' }, finish_reason: "stop" }],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        }),
        { status: 200 },
      ),
    );
    const llm = new OpenAICompatibleLLM("k", "qwen3.6-plus", "https://example.com/v1");
    const result = await llm.complete({ system: "s", prompt: "p" });
    expect(result.text).toBe('{"a":1}');
    fetchSpy.mockRestore();
  });

  it("aborts the request when the AbortSignal fires (real timeout path)", async () => {
    // Simulate fetch that honors the abort signal — how real fetch behaves
    // when AbortSignal.timeout() fires mid-flight.
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(
      (_url, init) =>
        new Promise<Response>((_, reject) => {
          const signal = (init as RequestInit).signal as AbortSignal;
          signal.addEventListener("abort", () => reject(signal.reason), { once: true });
        }),
    );
    // Tight 20ms timeout so the test is deterministic and doesn't wait 120s.
    const originalTimeout = AbortSignal.timeout;
    AbortSignal.timeout = () => originalTimeout.call(AbortSignal, 20);
    try {
      const llm = new OpenAICompatibleLLM("k", "qwen3.6-plus", "https://example.com/v1");
      const err = await llm.complete({ system: "s", prompt: "p" }).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(DOMException);
      expect((err as DOMException).name).toBe("TimeoutError");
    } finally {
      AbortSignal.timeout = originalTimeout;
      fetchSpy.mockRestore();
    }
  });
});
