import { describe, expect, it } from "vitest";
import {
  scoreToMReads,
  buildToMCalibrationReflections,
  type ToMCalibrationResult,
} from "../../src/processors/tom-calibration.js";
import type { ToMState, ToMEntry } from "../../src/types/theory-of-mind.js";

const personaName = (id: string): string =>
  ({ p1: "Alice", p2: "Bob", p3: "Carol" })[id] ?? id;

function entry(overrides: Partial<ToMEntry>): ToMEntry {
  return {
    about_persona_id: "p2",
    i_think_they_believe: "they want ship now",
    their_unstated_assumption: "engineers have spare cycles",
    my_confidence_in_this_read: 0.8,
    ...overrides,
  };
}

function tomState(observerId: string, entries: ToMEntry[]): ToMState {
  return {
    evaluation_id: "e1",
    observer_persona_id: observerId,
    round_number: 1,
    entries,
  };
}

describe("scoreToMReads", () => {
  it("returns empty map when no observers", () => {
    expect(scoreToMReads(new Map(), new Map()).size).toBe(0);
  });

  it("ignores low-confidence reads", () => {
    const priors = new Map([
      ["p1", tomState("p1", [entry({ about_persona_id: "p2", my_confidence_in_this_read: 0.4 })])],
    ]);
    const deltas = new Map([["p2", 0.5]]);
    const out = scoreToMReads(priors, deltas);
    expect(out.size).toBe(0);
  });

  it("ignores high-conf reads when target has no recorded delta", () => {
    const priors = new Map([
      ["p1", tomState("p1", [entry({ about_persona_id: "p2", my_confidence_in_this_read: 0.9 })])],
    ]);
    const deltas = new Map<string, number>();
    const out = scoreToMReads(priors, deltas);
    expect(out.size).toBe(0);
  });

  it("counts a high-conf read with no significant delta as a HIT (no miss)", () => {
    const priors = new Map([
      ["p1", tomState("p1", [entry({ about_persona_id: "p2", my_confidence_in_this_read: 0.9 })])],
    ]);
    const deltas = new Map([["p2", 0.05]]);
    const out = scoreToMReads(priors, deltas);
    expect(out.get("p1")?.totalHighConfReads).toBe(1);
    expect(out.get("p1")?.missedHighConfReads).toBe(0);
  });

  it("counts a high-conf read where target shifted significantly as a MISS", () => {
    const priors = new Map([
      ["p1", tomState("p1", [entry({ about_persona_id: "p2", my_confidence_in_this_read: 0.9 })])],
    ]);
    const deltas = new Map([["p2", 0.5]]);
    const out = scoreToMReads(priors, deltas);
    expect(out.get("p1")?.missedHighConfReads).toBe(1);
    expect(out.get("p1")?.examples[0]).toMatchObject({
      targetId: "p2",
      confidence: 0.9,
      targetDelta: 0.5,
    });
  });

  it("aggregates multiple targets per observer", () => {
    const priors = new Map([
      ["p1", tomState("p1", [
        entry({ about_persona_id: "p2", my_confidence_in_this_read: 0.9 }),
        entry({ about_persona_id: "p3", my_confidence_in_this_read: 0.8 }),
      ])],
    ]);
    const deltas = new Map([["p2", 0.5], ["p3", 0.05]]);
    const result = scoreToMReads(priors, deltas).get("p1")!;
    expect(result.totalHighConfReads).toBe(2);
    expect(result.missedHighConfReads).toBe(1);
  });

  it("scores multiple observers independently", () => {
    const priors = new Map([
      ["p1", tomState("p1", [entry({ about_persona_id: "p2", my_confidence_in_this_read: 0.9 })])],
      ["p2", tomState("p2", [entry({ about_persona_id: "p1", my_confidence_in_this_read: 0.8 })])],
    ]);
    const deltas = new Map([["p1", 0.4], ["p2", 0.05]]);
    const out = scoreToMReads(priors, deltas);
    expect(out.get("p1")?.missedHighConfReads).toBe(0);
    expect(out.get("p2")?.missedHighConfReads).toBe(1);
  });
});

describe("buildToMCalibrationReflections", () => {
  it("is silent when no scores", () => {
    expect(buildToMCalibrationReflections(new Map(), personaName)).toEqual([]);
  });

  it("is silent when miss rate is below threshold", () => {
    const scores = new Map<string, ToMCalibrationResult>([
      ["p1", { observerId: "p1", totalHighConfReads: 4, missedHighConfReads: 1, examples: [] }],
    ]);
    expect(buildToMCalibrationReflections(scores, personaName)).toEqual([]);
  });

  it("emits a named line when miss rate >= 50%", () => {
    const scores = new Map<string, ToMCalibrationResult>([
      ["p1", {
        observerId: "p1",
        totalHighConfReads: 2,
        missedHighConfReads: 1,
        examples: [{ targetId: "p2", confidence: 0.9, targetDelta: 0.5, observerBelief: "they want ship now" }],
      }],
    ]);
    const lines = buildToMCalibrationReflections(scores, personaName);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("@Alice");
    expect(lines[0]).toContain("Bob");
    expect(lines[0]).toContain("90%");
    expect(lines[0]).toContain("0.50");
    expect(lines[0]).toContain("Lower your confidence");
  });

  it("truncates long observerBelief in the example", () => {
    const longBelief = "x".repeat(200);
    const scores = new Map<string, ToMCalibrationResult>([
      ["p1", {
        observerId: "p1",
        totalHighConfReads: 1,
        missedHighConfReads: 1,
        examples: [{ targetId: "p2", confidence: 0.9, targetDelta: 0.5, observerBelief: longBelief }],
      }],
    ]);
    const lines = buildToMCalibrationReflections(scores, personaName);
    expect(lines[0]).toContain("…");
    expect(lines[0].length).toBeLessThan(longBelief.length + 200);
  });

  it("skips observers whose miss list is empty even if rate looks high", () => {
    const scores = new Map<string, ToMCalibrationResult>([
      ["p1", { observerId: "p1", totalHighConfReads: 2, missedHighConfReads: 2, examples: [] }],
    ]);
    expect(buildToMCalibrationReflections(scores, personaName)).toEqual([]);
  });
});
