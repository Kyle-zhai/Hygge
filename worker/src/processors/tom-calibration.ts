// ToM calibration feedback.
//
// After each round, every observer made high/low-confidence reads about every
// other persona's belief. By comparing those reads against the target's
// ACTUAL position shift in the FOLLOWING round, we can score which observers
// were over-confident — i.e. they claimed certainty about a target whose
// position then moved dramatically.
//
// Surfaced as a reflection line so over-confident observers get an explicit
// nudge to lower their `my_confidence_in_this_read` next round. This is the
// closest analog to the "self-reflection" loop in recent ToM-LLM papers
// (SimToM/Decompose-ToM) — but with zero extra LLM calls, since the signal
// comes from data we already track (ToM entries + belief history).

import type { ToMState } from "../types/theory-of-mind.js";

const HIGH_CONFIDENCE_THRESHOLD = 0.7;
const SIGNIFICANT_DELTA_THRESHOLD = 0.3;
const HIGH_MISS_RATE = 0.5;

export interface ToMCalibrationExample {
  targetId: string;
  confidence: number;
  targetDelta: number;
  observerBelief: string;
}

export interface ToMCalibrationResult {
  observerId: string;
  totalHighConfReads: number;
  missedHighConfReads: number;
  examples: ToMCalibrationExample[];
}

export function scoreToMReads(
  priorToM: Map<string, ToMState>,
  positionDeltas: Map<string, number>,
): Map<string, ToMCalibrationResult> {
  const out = new Map<string, ToMCalibrationResult>();

  for (const [observerId, state] of priorToM) {
    const result: ToMCalibrationResult = {
      observerId,
      totalHighConfReads: 0,
      missedHighConfReads: 0,
      examples: [],
    };

    for (const entry of state.entries) {
      if (entry.my_confidence_in_this_read < HIGH_CONFIDENCE_THRESHOLD) continue;
      const delta = positionDeltas.get(entry.about_persona_id);
      if (delta === undefined) continue;

      result.totalHighConfReads += 1;
      if (delta > SIGNIFICANT_DELTA_THRESHOLD) {
        result.missedHighConfReads += 1;
        result.examples.push({
          targetId: entry.about_persona_id,
          confidence: entry.my_confidence_in_this_read,
          targetDelta: delta,
          observerBelief: entry.i_think_they_believe,
        });
      }
    }

    if (result.totalHighConfReads > 0) {
      out.set(observerId, result);
    }
  }

  return out;
}

export function buildToMCalibrationReflections(
  scores: Map<string, ToMCalibrationResult>,
  personaName: (id: string) => string,
): string[] {
  const lines: string[] = [];

  for (const result of scores.values()) {
    if (result.totalHighConfReads === 0) continue;
    const missRate = result.missedHighConfReads / result.totalHighConfReads;
    if (missRate < HIGH_MISS_RATE) continue;

    const observer = personaName(result.observerId);
    const example = result.examples[0];
    if (!example) continue;

    const targetName = personaName(example.targetId);
    const confPct = Math.round(example.confidence * 100);
    const beliefSnippet = example.observerBelief.length > 80
      ? example.observerBelief.slice(0, 80) + "…"
      : example.observerBelief;

    lines.push(
      `@${observer} — ${result.missedHighConfReads}/${result.totalHighConfReads} of your high-confidence ToM reads last round were off (e.g. you were ${confPct}% sure ${targetName} "${beliefSnippet}" but their position shifted ${example.targetDelta.toFixed(2)}). Lower your confidence this round and consider what you missed.`,
    );
  }

  return lines;
}
