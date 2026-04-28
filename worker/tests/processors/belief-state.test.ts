import { describe, it, expect } from "vitest";
import {
  deriveInitialBeliefState,
  applyBeliefUpdate,
  DEFAULT_INITIAL_CONFIDENCE,
  type BeliefState,
} from "../../src/types/belief-state.js";
import { parseBeliefUpdate } from "../../src/processors/round-table-debate.js";
import { buildDebateRoundPrompt } from "../../src/prompts/round-table-debate.js";
import type { Persona } from "../../../shared/types/persona.js";
import type { ProjectParsedData } from "../../src/types/evaluation.js";

const baseProject: ProjectParsedData = {
  name: "X",
  description: "Y",
  target_users: "U",
  competitors: "C",
  goals: "G",
  success_metrics: "M",
};

const personaA = {
  id: "p-a",
  identity: { name: "Alice", avatar: "", tagline: "" },
  demographics: { occupation: "Designer" },
  psychology: { personality_type: "open", decision_making: { style: "intuitive" } },
} as unknown as Persona;

const personaB = {
  id: "p-b",
  identity: { name: "Bob", avatar: "", tagline: "" },
  demographics: { occupation: "Engineer" },
  psychology: { personality_type: "analytical", decision_making: { style: "data-driven" } },
} as unknown as Persona;

describe("deriveInitialBeliefState", () => {
  it("maps stance to position with strongly_positive", () => {
    const state = deriveInitialBeliefState({
      evaluation_id: "e1",
      persona_id: "p1",
      overall_stance: "strongly_positive",
      strengths: [],
      weaknesses: [],
    });
    expect(state.position).toBeCloseTo(0.8);
    expect(state.confidence).toBe(DEFAULT_INITIAL_CONFIDENCE);
    expect(state.round_number).toBe(0);
    expect(state.shifts_this_round).toEqual([]);
  });

  it("maps null stance to neutral position", () => {
    const state = deriveInitialBeliefState({
      evaluation_id: "e1",
      persona_id: "p1",
      overall_stance: null,
      strengths: [],
      weaknesses: [],
    });
    expect(state.position).toBe(0);
  });

  it("seeds key_evidence from up to 2 strengths and 2 weaknesses", () => {
    const state = deriveInitialBeliefState({
      evaluation_id: "e1",
      persona_id: "p1",
      overall_stance: "negative",
      strengths: ["s1", "s2", "s3"],
      weaknesses: ["w1", "w2"],
    });
    expect(state.position).toBe(-0.5);
    expect(state.key_evidence).toHaveLength(4);
    expect(state.key_evidence[0].content).toBe("s1");
    expect(state.key_evidence[2].content).toBe("w1");
  });

  it("skips empty strings in evidence", () => {
    const state = deriveInitialBeliefState({
      evaluation_id: "e1",
      persona_id: "p1",
      overall_stance: "neutral",
      strengths: ["", "  ", "real"],
      weaknesses: [],
    });
    expect(state.key_evidence).toHaveLength(1);
    expect(state.key_evidence[0].content).toBe("real");
  });
});

describe("applyBeliefUpdate", () => {
  const prev: BeliefState = {
    evaluation_id: "e1",
    persona_id: "p1",
    round_number: 0,
    position: 0.5,
    confidence: 0.6,
    key_evidence: [],
    considered_alternatives: [],
    shifts_this_round: [],
  };

  it("records a shift when position changes meaningfully", () => {
    const next = applyBeliefUpdate(prev, { new_position: 0.2, new_confidence: 0.5, shifted_because: "Bob's data" }, 1);
    expect(next.position).toBe(0.2);
    expect(next.confidence).toBe(0.5);
    expect(next.shifts_this_round).toHaveLength(1);
    expect(next.shifts_this_round[0].delta_position).toBeCloseTo(-0.3);
    expect(next.shifts_this_round[0].caused_by).toBe("Bob's data");
  });

  it("clamps position into [-1, 1]", () => {
    const next = applyBeliefUpdate(prev, { new_position: 5, new_confidence: -2, shifted_because: null }, 1);
    expect(next.position).toBe(1);
    expect(next.confidence).toBe(0);
  });

  it("records no shift when changes are below the noise floor", () => {
    const next = applyBeliefUpdate(prev, { new_position: 0.505, new_confidence: 0.605, shifted_because: null }, 1);
    expect(next.shifts_this_round).toEqual([]);
  });

  it("falls back to previous values when input is non-finite", () => {
    const next = applyBeliefUpdate(prev, { new_position: NaN, new_confidence: Infinity, shifted_because: null }, 1);
    expect(next.position).toBe(prev.position);
    expect(next.confidence).toBe(prev.confidence);
  });
});

describe("parseBeliefUpdate", () => {
  it("returns null for non-objects", () => {
    expect(parseBeliefUpdate(null)).toBeNull();
    expect(parseBeliefUpdate("x")).toBeNull();
    expect(parseBeliefUpdate(undefined)).toBeNull();
  });

  it("returns null when required fields are missing", () => {
    expect(parseBeliefUpdate({ new_position: 0.5 })).toBeNull();
    expect(parseBeliefUpdate({ new_confidence: 0.5 })).toBeNull();
  });

  it("parses a well-formed update", () => {
    const u = parseBeliefUpdate({ new_position: 0.3, new_confidence: 0.7, shifted_because: "X said Y" });
    expect(u).toEqual({ new_position: 0.3, new_confidence: 0.7, shifted_because: "X said Y" });
  });

  it("treats non-string shifted_because as null", () => {
    const u = parseBeliefUpdate({ new_position: 0, new_confidence: 0.5, shifted_because: 42 });
    expect(u?.shifted_because).toBeNull();
  });
});

describe("buildDebateRoundPrompt belief-state injection", () => {
  it("omits belief block when no states provided", () => {
    const { prompt } = buildDebateRoundPrompt(
      1,
      "Theme",
      [personaA, personaB],
      [],
      [],
      baseProject,
      "raw input",
    );
    expect(prompt).not.toContain("Current belief:");
    expect(prompt).not.toContain("active_listening");
    expect(prompt).not.toContain("belief_update");
  });

  it("injects belief state line and extends JSON schema when states provided", () => {
    const states = new Map([
      [
        "p-a",
        {
          evaluation_id: "e",
          persona_id: "p-a",
          round_number: 1,
          position: 0.7,
          confidence: 0.8,
          key_evidence: [],
          considered_alternatives: [],
          shifts_this_round: [
            { caused_by: "Bob", claim: "data point", delta_position: -0.1, delta_confidence: -0.05 },
          ],
        } satisfies BeliefState,
      ],
    ]);
    const { prompt } = buildDebateRoundPrompt(
      2,
      "Theme",
      [personaA, personaB],
      [],
      [{ round: 1, messages: [] }],
      baseProject,
      "raw input",
      states,
    );
    expect(prompt).toContain("Current belief:");
    expect(prompt).toContain("strongly support");
    expect(prompt).toContain("active_listening");
    expect(prompt).toContain("belief_update");
    expect(prompt).toContain("Last round:");
  });
});
