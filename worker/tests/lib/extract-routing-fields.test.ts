import { describe, it, expect, vi } from "vitest";
import { extractRoutingFields } from "../../src/lib/extract-routing-fields.js";
import type { LLMAdapter } from "../../src/llm/adapter.js";

function mockLLM(text: string): LLMAdapter {
  return {
    complete: vi.fn().mockResolvedValue({
      text,
      model: "mock",
      usage: { inputTokens: 100, outputTokens: 200 },
    }),
  };
}

const FULL_VALID = JSON.stringify({
  canonical_question: "Should we ship the recommender feature next week?",
  fields: {
    decision_type: { value: "build_or_kill", confidence: 0.9, source_quote: "ship the recommender" },
    primary_dimensions: { value: ["technical", "business"], confidence: 0.85, source_quote: null },
    timeline: { value: "weeks", confidence: 0.9, source_quote: "next week" },
    reversibility: { value: "two_way_door", confidence: 0.6, source_quote: null },
    stakes: { value: "medium", confidence: 0.5, source_quote: null },
    stakeholders: { value: ["EU users"], confidence: 0.7, source_quote: "EU users" },
    persona_hints: { value: [], confidence: 0.0, source_quote: null },
    alternatives: { value: [], confidence: 0.0, source_quote: null },
    constraints: { value: [], confidence: 0.0, source_quote: null },
  },
});

describe("extractRoutingFields", () => {
  it("parses valid LLM JSON into a RoutingExtract", async () => {
    const llm = mockLLM(FULL_VALID);
    const result = await extractRoutingFields(llm, ["Ship a recommender feature next week"]);
    expect(result.used_fallback).toBe(false);
    expect(result.canonical_question).toContain("recommender");
    expect(result.routing_extract.decision_type.value).toBe("build_or_kill");
    expect(result.routing_extract.primary_dimensions.value).toContain("technical");
  });

  it("clamps confidence to [0, 1]", async () => {
    const llm = mockLLM(JSON.stringify({
      canonical_question: "x",
      fields: {
        decision_type: { value: "other", confidence: 5, source_quote: null },
        primary_dimensions: { value: [], confidence: -2, source_quote: null },
        timeline: { value: "weeks", confidence: 0.5, source_quote: null },
        reversibility: { value: "unknown", confidence: 0.5, source_quote: null },
        stakes: { value: "unknown", confidence: 0.5, source_quote: null },
        stakeholders: { value: [], confidence: 0.5, source_quote: null },
        persona_hints: { value: [], confidence: 0.5, source_quote: null },
        alternatives: { value: [], confidence: 0.5, source_quote: null },
        constraints: { value: [], confidence: 0.5, source_quote: null },
      },
    }));
    const result = await extractRoutingFields(llm, ["x"]);
    expect(result.routing_extract.decision_type.confidence).toBe(1);
    expect(result.routing_extract.primary_dimensions.confidence).toBe(0);
  });

  it("falls back to regex extraction on LLM error", async () => {
    const failing: LLMAdapter = {
      complete: vi.fn().mockRejectedValue(new Error("LLM down")),
    };
    const result = await extractRoutingFields(failing, [
      "Should we hire the senior engineer candidate from the top team?",
    ]);
    expect(result.used_fallback).toBe(true);
    expect(result.routing_extract.decision_type.value).toBe("hire");
    expect(result.routing_extract.decision_type.confidence).toBe(0.5);
  });

  it("regex fallback recognizes Chinese decision-type cues", async () => {
    const failing: LLMAdapter = {
      complete: vi.fn().mockRejectedValue(new Error("LLM down")),
    };
    const result = await extractRoutingFields(failing, [
      "我们 SaaS 增长放缓,正在考虑战略转型,从 PLG 改成 sales-led",
    ]);
    expect(result.used_fallback).toBe(true);
    expect(result.routing_extract.decision_type.value).toBe("pivot");
  });

  it("marks priorAskedFields as was_asked=true", async () => {
    const llm = mockLLM(FULL_VALID);
    const result = await extractRoutingFields(
      llm,
      ["x"],
      new Set(["decision_type", "timeline"]),
    );
    expect(result.routing_extract.decision_type.was_asked).toBe(true);
    expect(result.routing_extract.timeline.was_asked).toBe(true);
    expect(result.routing_extract.stakes.was_asked).toBe(false);
  });
});
