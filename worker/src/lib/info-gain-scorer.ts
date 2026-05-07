// Picks the highest-info-gain field to ask about, given the current
// routing_extract. Implements the rule from spec §5.2:
//   info_gain = 1 - confidence
//   impact    = required ? 1.0 : strongly_recommended ? 0.5 : 0.2
//   score     = info_gain × impact
// Returns null when nothing is worth asking about.

import {
  KNOWN_CONFIDENCE_THRESHOLD,
  type RoutingExtract,
} from "../types/decision.js";

type FieldName = keyof RoutingExtract;

const REQUIRED: FieldName[] = ["decision_type", "primary_dimensions"];
const STRONGLY_RECOMMENDED: FieldName[] = ["timeline", "reversibility", "stakes"];

function impactWeight(field: FieldName): number {
  if (REQUIRED.includes(field)) return 1.0;
  if (STRONGLY_RECOMMENDED.includes(field)) return 0.5;
  return 0.2;
}

export interface FieldScore {
  field: FieldName;
  info_gain: number;
  impact: number;
  score: number;
  current_confidence: number;
}

export function scoreCandidateFields(
  extract: RoutingExtract,
  priorAskedFields: Set<string>,
): FieldScore[] {
  const fields = Object.keys(extract) as FieldName[];
  const scored: FieldScore[] = [];

  for (const field of fields) {
    // Don't re-ask a field that was already explicitly asked.
    if (priorAskedFields.has(field)) continue;

    const f = extract[field];
    const confidence = f.confidence;

    // Above threshold = "known" — don't ask.
    if (confidence >= KNOWN_CONFIDENCE_THRESHOLD) continue;

    const info_gain = 1 - confidence;
    const impact = impactWeight(field);
    const score = info_gain * impact;

    scored.push({ field, info_gain, impact, score, current_confidence: confidence });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored;
}

export function pickNextField(
  extract: RoutingExtract,
  priorAskedFields: Set<string>,
): FieldScore | null {
  const ranked = scoreCandidateFields(extract, priorAskedFields);
  return ranked[0] ?? null;
}

// Returns true iff all REQUIRED fields are at or above the known threshold.
export function allRequiredFilled(extract: RoutingExtract): boolean {
  for (const field of REQUIRED) {
    const f = extract[field];
    if (!f || f.confidence < KNOWN_CONFIDENCE_THRESHOLD) return false;
    // primary_dimensions also needs at least one entry to be meaningful
    if (field === "primary_dimensions") {
      const dims = f.value as unknown[];
      if (!Array.isArray(dims) || dims.length === 0) return false;
    }
  }
  return true;
}
