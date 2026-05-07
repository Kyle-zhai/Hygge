// Picks the persona ids to attach to a Brief, given the routing_extract.
// Wraps the existing recommend-personas.ts (LLM-based selector) but adds
// fallback heuristics so a flaky LLM still produces a usable persona set.

import type { LLMAdapter } from "../llm/adapter.js";
import type { Persona } from "../types/persona.js";
import type { RoutingExtract } from "../types/decision.js";
import { recommendPersonas } from "../processors/recommend-personas.js";
import { log } from "../utils/logger.js";

const MIN_PERSONAS = 3;
const MAX_PERSONAS = 6;

export async function pickPersonasForBrief(
  llm: LLMAdapter,
  extract: RoutingExtract,
  canonicalQuestion: string,
  available: Persona[],
): Promise<{ persona_ids: string[]; reasoning: string }> {
  if (available.length === 0) {
    return { persona_ids: [], reasoning: "no personas available" };
  }

  // Honour user-named persona hints first — these are explicit overrides.
  const hints = extract.persona_hints.value
    .map((h) => h.toLowerCase())
    .filter(Boolean);
  const hinted = hints.length
    ? available.filter((p) =>
        hints.some(
          (h) =>
            p.identity.name.toLowerCase().includes(h) ||
            p.demographics.occupation.toLowerCase().includes(h),
        ),
      )
    : [];

  // Build the topic description we feed to the LLM selector.
  const dimensions = extract.primary_dimensions.value.join(", ");
  const stakeholders = extract.stakeholders.value.join(", ") || "(none specified)";
  const topic = `Decision: ${canonicalQuestion}
Type: ${extract.decision_type.value}
Dimensions: ${dimensions}
Timeline: ${extract.timeline.value}
Reversibility: ${extract.reversibility.value}
Stakes: ${extract.stakes.value}
Stakeholders: ${stakeholders}`;

  try {
    const result = await recommendPersonas(llm, topic, available);
    const recommended = result.recommended_ids.filter((id) =>
      available.some((p) => p.id === id),
    );
    const merged = dedupe([...hinted.map((p) => p.id), ...recommended]);
    const clamped = clampSize(merged, available);
    return {
      persona_ids: clamped,
      reasoning: result.reasoning || "LLM selection",
    };
  } catch (err) {
    log.warn("intake.persona_selection.llm_failed_using_fallback", {
      error: err instanceof Error ? err.message : String(err),
    });
    const fallback = dedupe([
      ...hinted.map((p) => p.id),
      ...available.slice(0, MIN_PERSONAS).map((p) => p.id),
    ]);
    return {
      persona_ids: clampSize(fallback, available),
      reasoning: "fallback: hinted personas + first N available",
    };
  }
}

function dedupe(ids: string[]): string[] {
  return Array.from(new Set(ids));
}

function clampSize(ids: string[], available: Persona[]): string[] {
  if (ids.length >= MIN_PERSONAS) return ids.slice(0, MAX_PERSONAS);
  // Top up with available personas not already included.
  const have = new Set(ids);
  for (const p of available) {
    if (have.has(p.id)) continue;
    ids.push(p.id);
    have.add(p.id);
    if (ids.length >= MIN_PERSONAS) break;
  }
  return ids.slice(0, MAX_PERSONAS);
}
