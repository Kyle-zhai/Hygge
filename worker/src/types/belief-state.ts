import type { PersonaStance } from "./evaluation.js";

export interface BeliefEvidence {
  source: "internal_value" | "heard_from" | "common_sense";
  weight: number;
  content: string;
  from_speaker?: string;
  from_round?: number;
}

export interface BeliefShift {
  caused_by: string;
  claim: string;
  delta_position: number;
  delta_confidence: number;
}

export interface BeliefState {
  evaluation_id: string;
  persona_id: string;
  round_number: number;
  position: number;
  confidence: number;
  key_evidence: BeliefEvidence[];
  considered_alternatives: string[];
  shifts_this_round: BeliefShift[];
}

export interface ActiveListening {
  claims_heard_this_round: Array<{
    speaker: string;
    claim_summary: string;
    threatens_my_position: boolean;
  }>;
  must_address: string[];
}

export interface BeliefUpdate {
  new_position: number;
  new_confidence: number;
  shifted_because: string | null;
}

export interface DebateMessageWithBelief {
  persona_id: string;
  content: string;
  responding_to?: string | null;
  stance_shift?: string | null;
  active_listening?: ActiveListening;
  belief_update?: BeliefUpdate;
}

const STANCE_TO_POSITION: Record<PersonaStance, number> = {
  strongly_positive: 0.8,
  positive: 0.5,
  neutral: 0,
  negative: -0.5,
  strongly_negative: -0.8,
};

export const DEFAULT_INITIAL_CONFIDENCE = 0.7;

export function deriveInitialBeliefState(input: {
  evaluation_id: string;
  persona_id: string;
  overall_stance: PersonaStance | null | undefined;
  strengths: string[];
  weaknesses: string[];
}): BeliefState {
  const stance = input.overall_stance ?? "neutral";
  const position = STANCE_TO_POSITION[stance] ?? 0;

  const key_evidence: BeliefEvidence[] = [];
  const cleanStrengths = input.strengths.filter((s): s is string => typeof s === "string" && s.trim().length > 0);
  for (const s of cleanStrengths.slice(0, 2)) {
    key_evidence.push({
      source: "internal_value",
      weight: 0.5,
      content: s.trim().slice(0, 200),
    });
  }
  const cleanWeaknesses = input.weaknesses.filter((w): w is string => typeof w === "string" && w.trim().length > 0);
  for (const w of cleanWeaknesses.slice(0, 2)) {
    key_evidence.push({
      source: "internal_value",
      weight: 0.5,
      content: w.trim().slice(0, 200),
    });
  }

  return {
    evaluation_id: input.evaluation_id,
    persona_id: input.persona_id,
    round_number: 0,
    position,
    confidence: DEFAULT_INITIAL_CONFIDENCE,
    key_evidence,
    considered_alternatives: [],
    shifts_this_round: [],
  };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function applyBeliefUpdate(prev: BeliefState, update: BeliefUpdate, roundNumber: number): BeliefState {
  const newPosition = clamp(Number.isFinite(update.new_position) ? update.new_position : prev.position, -1, 1);
  const newConfidence = clamp(Number.isFinite(update.new_confidence) ? update.new_confidence : prev.confidence, 0, 1);
  const deltaPos = newPosition - prev.position;
  const deltaConf = newConfidence - prev.confidence;

  const shifts: BeliefShift[] = [];
  if (Math.abs(deltaPos) > 0.01 || Math.abs(deltaConf) > 0.01) {
    shifts.push({
      caused_by: update.shifted_because ?? "unspecified",
      claim: update.shifted_because ?? "",
      delta_position: deltaPos,
      delta_confidence: deltaConf,
    });
  }

  return {
    evaluation_id: prev.evaluation_id,
    persona_id: prev.persona_id,
    round_number: roundNumber,
    position: newPosition,
    confidence: newConfidence,
    key_evidence: prev.key_evidence,
    considered_alternatives: prev.considered_alternatives,
    shifts_this_round: shifts,
  };
}
