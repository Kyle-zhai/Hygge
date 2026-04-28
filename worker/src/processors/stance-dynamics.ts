import type { BeliefState } from "../types/belief-state.js";

export interface StanceDynamicsAnalysis {
  reflectionLines: string[];
  fastConvergence: boolean;
  frozenPersonaIds: string[];
  noConcessions: boolean;
  positionVariance: number | null;
}

export const CONVERGENCE_VARIANCE_THRESHOLD = 0.2;
export const FROZEN_DELTA_THRESHOLD = 0.05;

function variance(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sumSq = values.reduce((sum, v) => sum + (v - mean) ** 2, 0);
  return sumSq / values.length;
}

export function analyzeStanceDynamics(
  beliefStatesByPersona: Map<string, BeliefState[]>,
  upcomingRound: number,
): StanceDynamicsAnalysis {
  const reflectionLines: string[] = [];
  const frozenPersonaIds: string[] = [];
  let noConcessions = true;
  let fastConvergence = false;
  let positionVariance: number | null = null;

  const latestPositions: number[] = [];

  for (const [personaId, history] of beliefStatesByPersona) {
    if (history.length === 0) continue;
    const latest = history[history.length - 1];
    latestPositions.push(latest.position);

    const initial = history[0];
    if (history.length >= 3 && Math.abs(latest.position - initial.position) < FROZEN_DELTA_THRESHOLD) {
      frozenPersonaIds.push(personaId);
    }

    for (const state of history) {
      if (state.shifts_this_round.length > 0) {
        noConcessions = false;
      }
    }
  }

  if (upcomingRound > 1 && latestPositions.length >= 2) {
    positionVariance = variance(latestPositions);
    if (positionVariance < CONVERGENCE_VARIANCE_THRESHOLD) {
      fastConvergence = true;
      reflectionLines.push(
        `META-REFLECTION: All personas have converged to similar positions (variance ${positionVariance.toFixed(2)}). This may be premature — at least one persona should articulate the strongest remaining objection rather than agreeing too quickly.`,
      );
    }
  }

  if (frozenPersonaIds.length > 0) {
    reflectionLines.push(
      `META-REFLECTION: ${frozenPersonaIds.join(", ")} have not moved their position across the debate so far. They should engage with at least one specific argument that has been raised against them — either concede partially with a reason, or articulate a concrete counter.`,
    );
  }

  if (upcomingRound === 3 && noConcessions && latestPositions.length > 0) {
    reflectionLines.push(
      `META-REFLECTION: No persona has conceded any ground across the previous rounds. At least one persona should explicitly acknowledge a point from another that genuinely shifted their view, even if only a minor shift.`,
    );
  }

  return { reflectionLines, fastConvergence, frozenPersonaIds, noConcessions, positionVariance };
}
