import type { LLMAdapter } from "../llm/adapter.js";
import type { EvaluationScores } from "../types/evaluation.js";
import type { Persona } from "../types/persona.js";
import type { ScenarioSimulationResult } from "../types/report.js";
import { completeAndParseJson } from "../utils/llm-helpers.js";
import { buildScenarioSimulationPrompt } from "../prompts/scenario-simulation.js";
import type { ReplyLanguage } from "./language-detect.js";

export interface ReviewForSimulation {
  persona_id: string;
  persona_name: string;
  // Product mode: numeric scores; topic mode: stance strings keyed by dynamic dimension
  scores: EvaluationScores | Record<string, string>;
  review_text: string;
  strengths: string[];
  weaknesses: string[];
}

/** Simulate social dynamics among personas discussing the topic. */
export async function runScenarioSimulation(
  llm: LLMAdapter,
  personas: Persona[],
  reviews: ReviewForSimulation[],
  replyLanguage: ReplyLanguage = "en",
): Promise<ScenarioSimulationResult> {
  const { system, prompt, computedStances } = buildScenarioSimulationPrompt(personas, reviews, replyLanguage);
  const result = await completeAndParseJson<ScenarioSimulationResult>(
    llm,
    { system, prompt },
    "ScenarioSimulation",
    { base: 4096, retry: 8192 },
  );

  // Enforce initial_adoption stances from computed values (same thresholds as opinion-drift).
  // completeAndParseJson returns the typed shape, but the LLM can still emit
  // a non-array under that key — guard with Array.isArray before .map/.filter
  // so a malformed shape downgrades gracefully instead of crashing.
  if (Array.isArray(result.initial_adoption)) {
    result.initial_adoption = result.initial_adoption.map((a) => ({
      ...a,
      stance: (computedStances[a.persona_id] ?? a.stance) as "positive" | "neutral" | "negative",
    }));
  }

  // Compute adoption_rate_shift from actual stance data instead of trusting LLM
  if (
    Array.isArray(result.initial_adoption) &&
    Array.isArray(result.final_adoption) &&
    result.initial_adoption.length > 0 &&
    result.final_adoption.length > 0
  ) {
    const total = result.initial_adoption.length;
    const initialPositive = result.initial_adoption.filter((a) => a.stance === "positive").length;
    const finalPositive = result.final_adoption.filter((a) => a.stance === "positive").length;
    result.adoption_rate_shift = Math.round(((finalPositive - initialPositive) / total) * 100);
  }

  return result;
}
