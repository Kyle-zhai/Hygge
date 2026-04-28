import {
  type ToMEntry,
  type ToMState,
  TOM_ASSUMPTION_MAX_CHARS,
  TOM_BELIEF_MAX_CHARS,
} from "../types/theory-of-mind.js";
import { supabase } from "../supabase.js";
import { log } from "../utils/logger.js";

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) : s;
}

export function parseToMEntries(raw: unknown, validPersonaIds: Set<string>): ToMEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: ToMEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const about = typeof obj.about === "string" ? obj.about : typeof obj.about_persona_id === "string" ? obj.about_persona_id : null;
    if (!about || !validPersonaIds.has(about)) continue;
    const belief = typeof obj.i_think_they_believe === "string" ? obj.i_think_they_believe.trim() : "";
    const assumption = typeof obj.their_unstated_assumption === "string" ? obj.their_unstated_assumption.trim() : "";
    if (belief.length === 0 && assumption.length === 0) continue;
    const conf = typeof obj.my_confidence_in_this_read === "number" ? obj.my_confidence_in_this_read : 0.5;
    out.push({
      about_persona_id: about,
      i_think_they_believe: truncate(belief, TOM_BELIEF_MAX_CHARS),
      their_unstated_assumption: truncate(assumption, TOM_ASSUMPTION_MAX_CHARS),
      my_confidence_in_this_read: clamp(Number.isFinite(conf) ? conf : 0.5, 0, 1),
    });
  }
  return out;
}

export async function persistToMState(state: ToMState): Promise<void> {
  const { error } = await supabase.from("persona_tom_states").upsert(
    {
      evaluation_id: state.evaluation_id,
      observer_persona_id: state.observer_persona_id,
      round_number: state.round_number,
      entries: state.entries,
    },
    { onConflict: "evaluation_id,observer_persona_id,round_number" },
  );
  if (error) {
    log.warn("tom_state.persist_failed", {
      evaluationId: state.evaluation_id,
      observerId: state.observer_persona_id,
      round: state.round_number,
      error: error.message,
    });
  }
}

export interface ToMReadOfTarget {
  target_persona_id: string;
  prior_belief: string;
  prior_assumption: string;
  prior_confidence: number;
  actual_position_after_speaking: number | null;
}

export function buildPriorToMBlock(
  observerPersonaId: string,
  priorState: ToMState | undefined,
  personaName: (id: string) => string,
  latestPositionByPersona: Map<string, number> | undefined,
): string {
  if (!priorState || priorState.entries.length === 0) return "";

  const lines = priorState.entries.map((entry) => {
    const target = personaName(entry.about_persona_id);
    const conf = Math.round(entry.my_confidence_in_this_read * 100);
    const parts: string[] = [];
    if (entry.i_think_they_believe) {
      parts.push(`believes: "${entry.i_think_they_believe}"`);
    }
    if (entry.their_unstated_assumption) {
      parts.push(`unstated assumption: "${entry.their_unstated_assumption}"`);
    }
    let line = `  - You thought ${target} ${parts.join("; ")} (your confidence: ${conf}%).`;

    const actualPos = latestPositionByPersona?.get(entry.about_persona_id);
    if (actualPos !== undefined) {
      const direction = actualPos > 0.2 ? "support" : actualPos < -0.2 ? "opposition" : "neutral";
      line += ` Their actual position after last round: ${actualPos.toFixed(2)} (${direction}).`;
    }
    return line;
  });

  return [
    `Your prior theory-of-mind reads (what YOU thought ${personaName(observerPersonaId)} believed about each other persona, going into the previous round):`,
    ...lines,
    `If your prior read was wrong, name the gap explicitly this round: e.g. "@X — I thought you were assuming Y, but your last point shows you actually believe Z."`,
  ].join("\n");
}

export function buildToMSchemaField(otherPersonaIds: string[]): string {
  if (otherPersonaIds.length === 0) return "";
  return `,
      "theory_of_mind": [
        // ONE entry per OTHER persona in this debate (exclude your own persona_id).
        // Debate participants: ${otherPersonaIds.join(", ")}.
        // Be specific — "they believe X because they're assuming Y" — not generic ("they disagree").
        {
          "about": "<persona_id of someone OTHER than yourself>",
          "i_think_they_believe": "<≤200 chars: their position in YOUR words, including a specific claim from their last message>",
          "their_unstated_assumption": "<≤240 chars: the premise you think they're operating on but haven't stated. If you can't identify one, say 'none detected'.>",
          "my_confidence_in_this_read": <number 0..1: how sure are you this read is correct>
        }
      ]`;
}
