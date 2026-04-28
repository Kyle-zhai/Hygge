import type { BeliefShift, BeliefState } from "../types/belief-state.js";

export const PASSIVE_CONFIDENCE_NUDGE = 0.05;
export const PASSIVE_POSITION_NUDGE = 0.05;
export const SIGNIFICANT_SHIFT_THRESHOLD = 0.15;
export const NEUTRAL_OBSERVER_THRESHOLD = 0.15;

export interface SpeakerObservation {
  speakerId: string;
  delta_position: number;
  claim: string;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function applyPassiveObservations(
  observer: BeliefState,
  observations: SpeakerObservation[],
  roundNumber: number,
): BeliefState {
  let position = observer.position;
  let confidence = observer.confidence;
  const appendedShifts: BeliefShift[] = [];

  for (const obs of observations) {
    if (obs.speakerId === observer.persona_id) continue;
    if (Math.abs(obs.delta_position) < SIGNIFICANT_SHIFT_THRESHOLD) continue;

    const isNeutral = Math.abs(observer.position) < NEUTRAL_OBSERVER_THRESHOLD;

    if (isNeutral) {
      const dp = Math.sign(obs.delta_position) * PASSIVE_POSITION_NUDGE;
      const newPos = clamp(position + dp, -1, 1);
      const actualDp = newPos - position;
      position = newPos;
      appendedShifts.push({
        caused_by: `passive:${obs.speakerId}`,
        claim: obs.claim,
        delta_position: actualDp,
        delta_confidence: 0,
      });
    } else {
      const aligned = Math.sign(obs.delta_position) === Math.sign(observer.position);
      const dc = aligned ? PASSIVE_CONFIDENCE_NUDGE : -PASSIVE_CONFIDENCE_NUDGE;
      const newConf = clamp(confidence + dc, 0, 1);
      const actualDc = newConf - confidence;
      confidence = newConf;
      appendedShifts.push({
        caused_by: `passive:${obs.speakerId}`,
        claim: obs.claim,
        delta_position: 0,
        delta_confidence: actualDc,
      });
    }
  }

  if (appendedShifts.length === 0) return observer;

  return {
    ...observer,
    round_number: roundNumber,
    position,
    confidence,
    shifts_this_round: [...observer.shifts_this_round, ...appendedShifts],
  };
}
