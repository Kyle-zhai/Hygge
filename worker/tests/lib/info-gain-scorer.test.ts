import { describe, it, expect } from "vitest";
import {
  pickNextField,
  scoreCandidateFields,
  allRequiredFilled,
} from "../../src/lib/info-gain-scorer.js";
import type { RoutingExtract, ExtractedField } from "../../src/types/decision.js";

function f<T>(value: T, confidence: number, was_asked = false): ExtractedField<T> {
  return { value, confidence, source_quote: null, was_asked };
}

function buildExtract(overrides: Partial<RoutingExtract> = {}): RoutingExtract {
  const base: RoutingExtract = {
    decision_type: f("other", 0),
    primary_dimensions: f([], 0),
    timeline: f("weeks", 0),
    reversibility: f("unknown", 0),
    stakes: f("unknown", 0),
    stakeholders: f([], 0),
    persona_hints: f([], 0),
    alternatives: f([], 0),
    constraints: f([], 0),
  };
  return { ...base, ...overrides };
}

describe("info-gain-scorer", () => {
  it("ranks required fields above strongly-recommended above optional", () => {
    const extract = buildExtract();
    const ranked = scoreCandidateFields(extract, new Set());
    // Both required fields share the same impact (1.0); they should be at the top.
    const top2 = ranked.slice(0, 2).map((r) => r.field).sort();
    expect(top2).toEqual(["decision_type", "primary_dimensions"]);
    // Strongly-recommended fields with same info_gain rank below required.
    const timelineRank = ranked.findIndex((r) => r.field === "timeline");
    const stakeholdersRank = ranked.findIndex((r) => r.field === "stakeholders");
    expect(timelineRank).toBeGreaterThan(1);
    expect(stakeholdersRank).toBeGreaterThan(timelineRank);
  });

  it("excludes already-asked fields from candidate set", () => {
    const extract = buildExtract();
    const ranked = scoreCandidateFields(extract, new Set(["decision_type"]));
    expect(ranked.find((r) => r.field === "decision_type")).toBeUndefined();
  });

  it("excludes fields above the known-confidence threshold", () => {
    const extract = buildExtract({
      decision_type: f("hire", 0.85),
      timeline: f("weeks", 0.9),
    });
    const ranked = scoreCandidateFields(extract, new Set());
    expect(ranked.find((r) => r.field === "decision_type")).toBeUndefined();
    expect(ranked.find((r) => r.field === "timeline")).toBeUndefined();
  });

  it("pickNextField returns null when nothing is worth asking", () => {
    const extract = buildExtract({
      decision_type: f("hire", 0.9),
      primary_dimensions: f(["people"], 0.9),
      timeline: f("weeks", 0.9),
      reversibility: f("two_way_door", 0.9),
      stakes: f("medium", 0.9),
      stakeholders: f([], 0.9),
      persona_hints: f([], 0.9),
      alternatives: f([], 0.9),
      constraints: f([], 0.9),
    });
    expect(pickNextField(extract, new Set())).toBeNull();
  });

  it("allRequiredFilled requires confidence and a non-empty dimensions array", () => {
    expect(
      allRequiredFilled(
        buildExtract({
          decision_type: f("hire", 0.9),
          primary_dimensions: f(["people"], 0.9),
        }),
      ),
    ).toBe(true);

    // Empty dimensions array fails the check even with high confidence.
    expect(
      allRequiredFilled(
        buildExtract({
          decision_type: f("hire", 0.9),
          primary_dimensions: f([], 0.9),
        }),
      ),
    ).toBe(false);

    // Below-threshold required field fails.
    expect(
      allRequiredFilled(
        buildExtract({
          decision_type: f("hire", 0.5),
          primary_dimensions: f(["people"], 0.9),
        }),
      ),
    ).toBe(false);
  });

  it("score = info_gain × impact for required fields", () => {
    const extract = buildExtract({
      decision_type: f("other", 0.4),
    });
    const score = scoreCandidateFields(extract, new Set()).find((r) => r.field === "decision_type");
    expect(score?.info_gain).toBeCloseTo(0.6);
    expect(score?.impact).toBe(1.0);
    expect(score?.score).toBeCloseTo(0.6);
  });
});
