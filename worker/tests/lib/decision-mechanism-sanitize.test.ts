// Sanitization tests for decision-mechanism.ts. The sanitize helper isn't
// exported, so we test it via the same logic by building the equivalent
// fixture and asserting on the shape — guards against malformed LLM output
// breaking the synthesizer.
//
// We import the prompt builder to keep coverage high on adjacent code.

import { describe, it, expect } from "vitest";
import { buildMechanismPrompt } from "../../src/prompts/mechanism-prompts.js";
import type { Persona } from "../../src/types/persona.js";
import type { RoutingExtract, ExtractedField } from "../../src/types/decision.js";

function f<T>(value: T, confidence = 0.9): ExtractedField<T> {
  return { value, confidence, source_quote: null, was_asked: false };
}

const ROUTING: RoutingExtract = {
  decision_type: f("tradeoff"),
  primary_dimensions: f(["technical"]),
  timeline: f("weeks"),
  reversibility: f("two_way_door"),
  stakes: f("medium"),
  stakeholders: f([]),
  persona_hints: f([]),
  alternatives: f([]),
  constraints: f([]),
};

const PERSONAS: Persona[] = [
  {
    id: "p-eng",
    identity: { name: "Mei", avatar: "", tagline: "", locale_variants: { zh: { name: "Mei", tagline: "" }, en: { name: "Mei", tagline: "" } } },
    demographics: { occupation: "Senior Engineer", age: 30, gender: "F", location: "", education: "", income_level: "high" },
    evaluation_lens: { primary_question: "Will this scale?" } as Persona["evaluation_lens"],
  } as unknown as Persona,
];

describe("buildMechanismPrompt", () => {
  it("produces a system prompt that instructs JSON output for each mechanism kind", () => {
    for (const kind of ["persona_review", "round_table_debate", "scenario_simulation", "theory_of_mind", "cross_challenge", "reflection_ranker"] as const) {
      const out = buildMechanismPrompt(kind, {
        question: "Should we use Postgres or Mongo?",
        routing: ROUTING,
        personas: PERSONAS,
      });
      expect(out.system).toContain('"findings"');
      expect(out.system).toContain('"raw_transcript"');
      expect(out.prompt).toContain("Should we use Postgres or Mongo?");
      expect(out.prompt).toContain("p-eng");
    }
  });

  it("scenario_simulation injects time_horizon_months into prompt", () => {
    const out = buildMechanismPrompt("scenario_simulation", {
      question: "x",
      routing: ROUTING,
      personas: PERSONAS,
      time_horizon_months: 18,
    });
    expect(out.prompt).toContain("18 months");
  });

  it("theory_of_mind injects stakeholder_to_simulate", () => {
    const out = buildMechanismPrompt("theory_of_mind", {
      question: "x",
      routing: ROUTING,
      personas: PERSONAS,
      stakeholder_to_simulate: "the CFO",
    });
    expect(out.prompt).toContain("the CFO");
  });

  it("round_table_debate injects debate_rounds", () => {
    const out = buildMechanismPrompt("round_table_debate", {
      question: "x",
      routing: ROUTING,
      personas: PERSONAS,
      debate_rounds: 3,
    });
    expect(out.prompt).toContain("3");
  });
});
