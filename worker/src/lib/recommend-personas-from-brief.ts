// Picks the persona ids to attach to a Brief, given the routing_extract.
// Wraps the existing recommend-personas.ts (LLM-based selector) but adds
// fallback heuristics so a flaky LLM still produces a usable persona set.

import type { LLMAdapter } from "../llm/adapter.js";
import type { Persona } from "../types/persona.js";
import type { RoutingExtract } from "../types/decision.js";
import { recommendPersonas } from "../processors/recommend-personas.js";
import { log } from "../utils/logger.js";

// Hard floor / ceiling for the picker. The user-facing UI lets users pick
// inside [3, 25]; this enforces the same range when called server-side
// without an explicit count, and acts as a safety net when the count
// passed in is malformed.
const MIN_PERSONAS = 3;
const MAX_PERSONAS = 25;
const DEFAULT_TARGET = 10;

export async function pickPersonasForBrief(
  llm: LLMAdapter,
  extract: RoutingExtract,
  canonicalQuestion: string,
  available: Persona[],
  targetCount: number = DEFAULT_TARGET,
): Promise<{ persona_ids: string[]; reasoning: string }> {
  const target = Math.max(
    MIN_PERSONAS,
    Math.min(MAX_PERSONAS, Math.round(targetCount)),
  );
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
    const result = await recommendPersonas(llm, topic, available, target);
    const recommended = result.recommended_ids.filter((id) =>
      available.some((p) => p.id === id),
    );
    const merged = dedupe([...hinted.map((p) => p.id), ...recommended]);
    const clamped = clampToTarget(merged, available, target);
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
      ...available.slice(0, target).map((p) => p.id),
    ]);
    return {
      persona_ids: clampToTarget(fallback, available, target),
      reasoning: "fallback: hinted personas + first N available",
    };
  }
}

function dedupe(ids: string[]): string[] {
  return Array.from(new Set(ids));
}

function clampToTarget(
  ids: string[],
  available: Persona[],
  target: number,
): string[] {
  // Top up with un-picked available personas if we're short of the target.
  // Truncates to target if the LLM over-picked. Falls back to MIN if even
  // topping up can't reach target (small pools).
  if (ids.length < target) {
    const have = new Set(ids);
    for (const p of available) {
      if (have.has(p.id)) continue;
      ids.push(p.id);
      have.add(p.id);
      if (ids.length >= target) break;
    }
  }
  if (ids.length > target) return ids.slice(0, target);
  // If pool was too small to even hit MIN, return what we have rather
  // than an empty list — the seal step will catch and surface the
  // empty-personas error if it's truly zero.
  if (ids.length < MIN_PERSONAS) return ids;
  return ids;
}
