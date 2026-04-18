import { describe, it, expect, vi } from "vitest";
import { OpenAICompatibleLLM } from "../../src/llm/openai-compatible.js";

describe("LLM Adapter", () => {
  it("OpenAICompatibleLLM implements LLMAdapter interface", () => {
    const llm = new OpenAICompatibleLLM("fake-key", "qwen-max", "https://dashscope.aliyuncs.com/compatible-mode/v1");
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

    const llm = new OpenAICompatibleLLM("fake-key", "qwen-max", "https://dashscope.aliyuncs.com/compatible-mode/v1");

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
    const llm = new OpenAICompatibleLLM("k", "qwen-max", "https://example.com/v1");
    await llm.complete({ system: "s", prompt: "p" });
    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
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
      const llm = new OpenAICompatibleLLM("k", "qwen-max", "https://example.com/v1");
      const err = await llm.complete({ system: "s", prompt: "p" }).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(DOMException);
      expect((err as DOMException).name).toBe("TimeoutError");
    } finally {
      AbortSignal.timeout = originalTimeout;
      fetchSpy.mockRestore();
    }
  });
});
