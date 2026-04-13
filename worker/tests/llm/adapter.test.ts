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
});
