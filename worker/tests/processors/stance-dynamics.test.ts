import { describe, expect, it } from "vitest";
import { analyzeStanceDynamics } from "../../src/processors/stance-dynamics.js";
import type { BeliefState } from "../../src/types/belief-state.js";

function state(overrides: Partial<BeliefState> & { round_number: number; position: number }): BeliefState {
  return {
    evaluation_id: "eval-1",
    persona_id: "p1",
    confidence: 0.7,
    key_evidence: [],
    considered_alternatives: [],
    shifts_this_round: [],
    ...overrides,
  };
}

describe("analyzeStanceDynamics", () => {
  it("returns no reflections when history is empty", () => {
    const result = analyzeStanceDynamics(new Map(), 2);
    expect(result.reflectionLines).toEqual([]);
    expect(result.fastConvergence).toBe(false);
    expect(result.frozenPersonaIds).toEqual([]);
  });

  it("detects fast convergence when positions cluster tightly", () => {
    const history = new Map<string, BeliefState[]>([
      ["p1", [state({ persona_id: "p1", round_number: 0, position: 0.8 }), state({ persona_id: "p1", round_number: 1, position: 0.5 })]],
      ["p2", [state({ persona_id: "p2", round_number: 0, position: -0.5 }), state({ persona_id: "p2", round_number: 1, position: 0.5 })]],
      ["p3", [state({ persona_id: "p3", round_number: 0, position: 0.0 }), state({ persona_id: "p3", round_number: 1, position: 0.5 })]],
    ]);
    const result = analyzeStanceDynamics(history, 2);
    expect(result.fastConvergence).toBe(true);
    expect(result.positionVariance).not.toBeNull();
    expect(result.positionVariance!).toBeLessThan(0.2);
    expect(result.reflectionLines.some((l) => l.includes("converged"))).toBe(true);
  });

  it("does not flag convergence on round 1 (no prior data to compare)", () => {
    const history = new Map<string, BeliefState[]>([
      ["p1", [state({ persona_id: "p1", round_number: 0, position: 0.5 })]],
      ["p2", [state({ persona_id: "p2", round_number: 0, position: 0.5 })]],
    ]);
    const result = analyzeStanceDynamics(history, 1);
    expect(result.fastConvergence).toBe(false);
  });

  it("does not flag convergence when positions are spread out", () => {
    const history = new Map<string, BeliefState[]>([
      ["p1", [state({ persona_id: "p1", round_number: 0, position: 0.8 }), state({ persona_id: "p1", round_number: 1, position: 0.8 })]],
      ["p2", [state({ persona_id: "p2", round_number: 0, position: -0.8 }), state({ persona_id: "p2", round_number: 1, position: -0.8 })]],
    ]);
    const result = analyzeStanceDynamics(history, 2);
    expect(result.fastConvergence).toBe(false);
  });

  it("detects frozen personas (no movement across 3+ snapshots)", () => {
    const history = new Map<string, BeliefState[]>([
      ["frozen-p", [
        state({ persona_id: "frozen-p", round_number: 0, position: 0.5 }),
        state({ persona_id: "frozen-p", round_number: 1, position: 0.51 }),
        state({ persona_id: "frozen-p", round_number: 2, position: 0.52 }),
      ]],
      ["mobile-p", [
        state({ persona_id: "mobile-p", round_number: 0, position: -0.5 }),
        state({ persona_id: "mobile-p", round_number: 1, position: -0.2 }),
        state({ persona_id: "mobile-p", round_number: 2, position: 0.1 }),
      ]],
    ]);
    const result = analyzeStanceDynamics(history, 3);
    expect(result.frozenPersonaIds).toEqual(["frozen-p"]);
    expect(result.reflectionLines.some((l) => l.includes("frozen-p"))).toBe(true);
  });

  it("does not flag frozen until at least 3 snapshots exist", () => {
    const history = new Map<string, BeliefState[]>([
      ["p1", [
        state({ persona_id: "p1", round_number: 0, position: 0.5 }),
        state({ persona_id: "p1", round_number: 1, position: 0.5 }),
      ]],
    ]);
    const result = analyzeStanceDynamics(history, 2);
    expect(result.frozenPersonaIds).toEqual([]);
  });

  it("detects no-concessions only on round 3", () => {
    const history = new Map<string, BeliefState[]>([
      ["p1", [
        state({ persona_id: "p1", round_number: 0, position: 0.5, shifts_this_round: [] }),
        state({ persona_id: "p1", round_number: 1, position: 0.5, shifts_this_round: [] }),
        state({ persona_id: "p1", round_number: 2, position: 0.5, shifts_this_round: [] }),
      ]],
      ["p2", [
        state({ persona_id: "p2", round_number: 0, position: -0.5, shifts_this_round: [] }),
        state({ persona_id: "p2", round_number: 1, position: -0.5, shifts_this_round: [] }),
        state({ persona_id: "p2", round_number: 2, position: -0.5, shifts_this_round: [] }),
      ]],
    ]);
    const r2 = analyzeStanceDynamics(history, 2);
    expect(r2.noConcessions).toBe(true);
    expect(r2.reflectionLines.some((l) => l.includes("conceded any ground"))).toBe(false);

    const r3 = analyzeStanceDynamics(history, 3);
    expect(r3.noConcessions).toBe(true);
    expect(r3.reflectionLines.some((l) => l.includes("conceded any ground"))).toBe(true);
  });

  it("noConcessions is false when any state recorded a shift", () => {
    const history = new Map<string, BeliefState[]>([
      ["p1", [
        state({ persona_id: "p1", round_number: 0, position: 0.5 }),
        state({ persona_id: "p1", round_number: 1, position: 0.3, shifts_this_round: [{ caused_by: "p2", claim: "x", delta_position: -0.2, delta_confidence: 0 }] }),
      ]],
    ]);
    const result = analyzeStanceDynamics(history, 2);
    expect(result.noConcessions).toBe(false);
  });

  it("can flag multiple conditions simultaneously on round 3", () => {
    const history = new Map<string, BeliefState[]>([
      ["frozen", [
        state({ persona_id: "frozen", round_number: 0, position: 0.5 }),
        state({ persona_id: "frozen", round_number: 1, position: 0.5 }),
        state({ persona_id: "frozen", round_number: 2, position: 0.5 }),
      ]],
      ["also-frozen", [
        state({ persona_id: "also-frozen", round_number: 0, position: 0.5 }),
        state({ persona_id: "also-frozen", round_number: 1, position: 0.5 }),
        state({ persona_id: "also-frozen", round_number: 2, position: 0.5 }),
      ]],
    ]);
    const result = analyzeStanceDynamics(history, 3);
    expect(result.fastConvergence).toBe(true);
    expect(result.frozenPersonaIds.length).toBe(2);
    expect(result.noConcessions).toBe(true);
    expect(result.reflectionLines.length).toBe(3);
  });
});
