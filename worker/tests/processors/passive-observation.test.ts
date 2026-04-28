import { describe, expect, it } from "vitest";
import {
  applyPassiveObservations,
  PASSIVE_CONFIDENCE_NUDGE,
  PASSIVE_POSITION_NUDGE,
  type SpeakerObservation,
} from "../../src/processors/passive-observation.js";
import type { BeliefState } from "../../src/types/belief-state.js";

function observer(overrides: Partial<BeliefState> & { persona_id: string; position: number; confidence: number }): BeliefState {
  return {
    evaluation_id: "eval-1",
    round_number: 1,
    key_evidence: [],
    considered_alternatives: [],
    shifts_this_round: [],
    ...overrides,
  };
}

describe("applyPassiveObservations", () => {
  it("returns the same state when there are no observations", () => {
    const obs = observer({ persona_id: "B", position: 0.5, confidence: 0.6 });
    const result = applyPassiveObservations(obs, [], 2);
    expect(result).toBe(obs);
  });

  it("skips the observer's own observations", () => {
    const obs = observer({ persona_id: "B", position: 0.5, confidence: 0.6 });
    const speakers: SpeakerObservation[] = [
      { speakerId: "B", delta_position: 0.5, claim: "self" },
    ];
    const result = applyPassiveObservations(obs, speakers, 2);
    expect(result).toBe(obs);
  });

  it("ignores speaker shifts below the significant threshold", () => {
    const obs = observer({ persona_id: "B", position: 0.5, confidence: 0.6 });
    const speakers: SpeakerObservation[] = [
      { speakerId: "A", delta_position: 0.05, claim: "tiny" },
    ];
    const result = applyPassiveObservations(obs, speakers, 2);
    expect(result).toBe(obs);
  });

  it("nudges a neutral observer toward the speaker's shift direction", () => {
    const obs = observer({ persona_id: "B", position: 0.0, confidence: 0.6 });
    const speakers: SpeakerObservation[] = [
      { speakerId: "A", delta_position: 0.4, claim: "data shows growth" },
    ];
    const result = applyPassiveObservations(obs, speakers, 2);
    expect(result.position).toBeCloseTo(PASSIVE_POSITION_NUDGE, 5);
    expect(result.confidence).toBe(0.6);
    expect(result.shifts_this_round).toHaveLength(1);
    expect(result.shifts_this_round[0].caused_by).toBe("passive:A");
  });

  it("raises confidence when an aligned speaker shifts further in the observer's direction", () => {
    const obs = observer({ persona_id: "B", position: 0.5, confidence: 0.6 });
    const speakers: SpeakerObservation[] = [
      { speakerId: "A", delta_position: 0.3, claim: "agrees" },
    ];
    const result = applyPassiveObservations(obs, speakers, 2);
    expect(result.position).toBe(0.5);
    expect(result.confidence).toBeCloseTo(0.6 + PASSIVE_CONFIDENCE_NUDGE, 5);
    expect(result.shifts_this_round[0].delta_confidence).toBeCloseTo(PASSIVE_CONFIDENCE_NUDGE, 5);
  });

  it("lowers confidence when a misaligned speaker shifts away from the observer", () => {
    const obs = observer({ persona_id: "B", position: 0.5, confidence: 0.6 });
    const speakers: SpeakerObservation[] = [
      { speakerId: "A", delta_position: -0.3, claim: "opposes" },
    ];
    const result = applyPassiveObservations(obs, speakers, 2);
    expect(result.confidence).toBeCloseTo(0.6 - PASSIVE_CONFIDENCE_NUDGE, 5);
    expect(result.shifts_this_round[0].delta_confidence).toBeCloseTo(-PASSIVE_CONFIDENCE_NUDGE, 5);
  });

  it("accumulates effects from multiple speakers", () => {
    const obs = observer({ persona_id: "B", position: 0.5, confidence: 0.6 });
    const speakers: SpeakerObservation[] = [
      { speakerId: "A", delta_position: 0.3, claim: "agrees" },
      { speakerId: "C", delta_position: 0.4, claim: "also agrees" },
    ];
    const result = applyPassiveObservations(obs, speakers, 2);
    expect(result.confidence).toBeCloseTo(0.6 + 2 * PASSIVE_CONFIDENCE_NUDGE, 5);
    expect(result.shifts_this_round).toHaveLength(2);
  });

  it("preserves existing shifts (appends rather than replaces)", () => {
    const existing = {
      caused_by: "active:self",
      claim: "I changed my mind",
      delta_position: 0.1,
      delta_confidence: 0,
    };
    const obs = observer({
      persona_id: "B",
      position: 0.5,
      confidence: 0.6,
      shifts_this_round: [existing],
    });
    const speakers: SpeakerObservation[] = [
      { speakerId: "A", delta_position: 0.3, claim: "agrees" },
    ];
    const result = applyPassiveObservations(obs, speakers, 2);
    expect(result.shifts_this_round).toHaveLength(2);
    expect(result.shifts_this_round[0]).toBe(existing);
    expect(result.shifts_this_round[1].caused_by).toBe("passive:A");
  });

  it("clamps confidence at 1.0", () => {
    const obs = observer({ persona_id: "B", position: 0.5, confidence: 0.99 });
    const speakers: SpeakerObservation[] = [
      { speakerId: "A", delta_position: 0.3, claim: "agrees" },
    ];
    const result = applyPassiveObservations(obs, speakers, 2);
    expect(result.confidence).toBe(1.0);
    expect(result.shifts_this_round[0].delta_confidence).toBeCloseTo(0.01, 5);
  });

  it("clamps confidence at 0.0", () => {
    const obs = observer({ persona_id: "B", position: 0.5, confidence: 0.02 });
    const speakers: SpeakerObservation[] = [
      { speakerId: "A", delta_position: -0.3, claim: "opposes" },
    ];
    const result = applyPassiveObservations(obs, speakers, 2);
    expect(result.confidence).toBe(0);
    expect(result.shifts_this_round[0].delta_confidence).toBeCloseTo(-0.02, 5);
  });

  it("clamps neutral observer position within [-1, 1]", () => {
    const obs = observer({ persona_id: "B", position: 0.97, confidence: 0.6 });
    expect(Math.abs(obs.position) > 0.15).toBe(true);
    const neutral = observer({ persona_id: "C", position: 0.0, confidence: 0.6 });
    const speakers: SpeakerObservation[] = [
      { speakerId: "A", delta_position: 0.3, claim: "shifts" },
    ];
    const result = applyPassiveObservations(neutral, speakers, 2);
    expect(result.position).toBeCloseTo(PASSIVE_POSITION_NUDGE, 5);
  });

  it("updates round_number to the new round when changes occur", () => {
    const obs = observer({ persona_id: "B", position: 0.5, confidence: 0.6, round_number: 1 });
    const speakers: SpeakerObservation[] = [
      { speakerId: "A", delta_position: 0.3, claim: "agrees" },
    ];
    const result = applyPassiveObservations(obs, speakers, 5);
    expect(result.round_number).toBe(5);
  });
});
