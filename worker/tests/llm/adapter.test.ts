import { describe, it, expect, vi } from "vitest";
import { ClaudeLLM } from "../../src/llm/claude.js";

describe("LLM Adapter", () => {
  it("ClaudeLLM implements LLMAdapter interface", () => {
    const llm = new ClaudeLLM("fake-key", "claude-sonnet-4-6");
    expect(llm).toHaveProperty("complete");
    expect(typeof llm.complete).toBe("function");
  });

  it("ClaudeLLM.complete calls Anthropic API with correct params", async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: '{"result": "test"}' }],
      usage: { input_tokens: 100, output_tokens: 50 },
    });

    const llm = new ClaudeLLM("fake-key", "claude-sonnet-4-6");
    (llm as any).client = { messages: { create: mockCreate } };

    const result = await llm.complete({
      system: "You are a helpful assistant.",
      prompt: "Say hello",
      maxTokens: 1000,
    });

    expect(mockCreate).toHaveBeenCalledWith({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system: "You are a helpful assistant.",
      messages: [{ role: "user", content: "Say hello" }],
    });

    expect(result.text).toBe('{"result": "test"}');
    expect(result.usage).toEqual({ inputTokens: 100, outputTokens: 50 });
  });
});
