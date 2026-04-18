import { describe, it, expect, vi } from "vitest";
import { generatePersonaReview } from "../../src/processors/persona-review.js";
import type { LLMAdapter } from "../../src/llm/adapter.js";
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
