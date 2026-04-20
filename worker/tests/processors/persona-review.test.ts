import { describe, it, expect, vi } from "vitest";
import { generatePersonaReview } from "../../src/processors/persona-review.js";
import { LLMTruncatedError, type LLMAdapter } from "../../src/llm/adapter.js";
import type { Persona } from "../../../shared/types/persona.js";
import type { ProjectParsedData } from "../../../shared/types/evaluation.js";

const mockPersona = {
  id: "persona-1",
  identity: { name: "Sarah Chen", avatar: "", tagline: "Indie dev",
    locale_variants: { zh: { name: "陈莎拉", tagline: "独立开发者" }, en: { name: "Sarah Chen", tagline: "Indie dev" } } },
  system_prompt: "You are Sarah Chen, an indie developer...",
} as unknown as Persona;

const mockProject: ProjectParsedData = {
  name: "TestApp", description: "A test application", target_users: "Developers",
  competitors: "None", goals: "Get users", success_metrics: "DAU",
};

function mockLLM(responseText: string, model = "mock-model"): LLMAdapter {
  return {
    complete: vi.fn().mockResolvedValue({
      text: responseText, model, usage: { inputTokens: 200, outputTokens: 300 },
    }),
  };
}

describe("generatePersonaReview", () => {
  it("generates a review with scores, text, strengths, and weaknesses", async () => {
    const llm = mockLLM(JSON.stringify({
      scores: { usability: 8, market_fit: 7, design: 6, tech_quality: 9, innovation: 7, pricing: 5 },
      review_text: "As an indie developer, I find this tool quite useful...",
      strengths: ["Good API design", "Fast performance"],
      weaknesses: ["Pricing is too high", "Limited integrations"],
    }));

    const result = await generatePersonaReview(llm, mockPersona, mockProject, "I made a dev tool");
    expect(result.scores.usability).toBe(8);
    expect(result.scores.tech_quality).toBe(9);
    expect(result.review_text).toContain("indie developer");
    expect(result.strengths).toHaveLength(2);
    expect(result.weaknesses).toHaveLength(2);
    expect(result.llm_model).toBe("mock-model");
  });

  it("retries with a higher token budget when the first call is truncated", async () => {
    const goodPayload = JSON.stringify({
      scores: { usability: 8, market_fit: 7, design: 6, tech_quality: 9, innovation: 7, pricing: 5 },
      review_text: "Recovered after truncation.",
      strengths: ["a"],
      weaknesses: ["b"],
    });
    const complete = vi
      .fn()
      .mockRejectedValueOnce(new LLMTruncatedError("openai_compatible", "qwen", 2048, '{"scores":{"usabil'))
      .mockResolvedValue({ text: goodPayload, model: "qwen", usage: { inputTokens: 100, outputTokens: 500 } });
    const llm: LLMAdapter = { complete };

    const result = await generatePersonaReview(llm, mockPersona, mockProject, "I made a dev tool");
    expect(result.review_text).toBe("Recovered after truncation.");
    // First two calls: initial (BASE) + recovery retry (RETRY budget).
    expect(complete.mock.calls[0][0].maxTokens).toBe(4096);
    expect(complete.mock.calls[1][0].maxTokens).toBe(6144);
  });

  it("retries when the first response is unparseable JSON", async () => {
    const goodPayload = JSON.stringify({
      scores: { usability: 5, market_fit: 5, design: 5, tech_quality: 5, innovation: 5, pricing: 5 },
      review_text: "Recovered after parse failure.",
      strengths: [],
      weaknesses: [],
    });
    const complete = vi
      .fn()
      // Mid-key truncation with no closing — closeUnbalancedBrackets can't recover this one,
      // so robustJsonParse throws and tryComplete returns truncated → trigger recovery retry.
      .mockResolvedValueOnce({ text: '{"scores": {"usability": 1, "market_fit', model: "qwen", usage: { inputTokens: 100, outputTokens: 50 } })
      .mockResolvedValue({ text: goodPayload, model: "qwen", usage: { inputTokens: 100, outputTokens: 500 } });
    const llm: LLMAdapter = { complete };

    const result = await generatePersonaReview(llm, mockPersona, mockProject, "I made a dev tool");
    expect(result.review_text).toBe("Recovered after parse failure.");
    expect(complete.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("throws after MAX_RETRIES truncations in a row", async () => {
    const complete = vi
      .fn()
      .mockRejectedValue(new LLMTruncatedError("openai_compatible", "qwen", 4096, "{"));
    const llm: LLMAdapter = { complete };

    await expect(generatePersonaReview(llm, mockPersona, mockProject, "I made a dev tool")).rejects.toThrow(
      /truncated\/unparseable/,
    );
    expect(complete).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  it("records the fallback model when the chain falls through mid-review", async () => {
    // Simulates FallbackLLM returning the second entry's model on a successful
    // response: llm_model must reflect the model that actually produced the output.
    const llm = mockLLM(JSON.stringify({
      scores: { usability: 7, market_fit: 7, design: 7, tech_quality: 7, innovation: 7, pricing: 7 },
      review_text: "Review text from the fallback entry.",
      strengths: ["a"],
      weaknesses: ["b"],
    }), "claude-sonnet-4-6");
    const result = await generatePersonaReview(llm, mockPersona, mockProject, "I made a dev tool");
    expect(result.llm_model).toBe("claude-sonnet-4-6");
  });
});
