import type { LLMAdapter } from "../llm/adapter.js";
import type { EvaluationScores } from "../types/evaluation.js";
import type { Persona } from "../types/persona.js";
import type { ScenarioSimulationResult } from "../types/report.js";
import { buildScenarioSimulationPrompt } from "../prompts/scenario-simulation.js";

export interface ReviewForSimulation {
  persona_id: string;
  persona_name: string;
  // Product mode: numeric scores; topic mode: stance strings keyed by dynamic dimension
  scores: EvaluationScores | Record<string, string>;
}

/** Simulate social dynamics among personas discussing the topic. */
export async function runScenarioSimulation(
  llm: LLMAdapter,
  personas: Persona[],
  reviews: ReviewForSimulation[]
): Promise<ScenarioSimulationResult> {
  const { system, prompt } = buildScenarioSimulationPrompt(personas, reviews);
  const response = await llm.complete({ system, prompt, maxTokens: 4096 });
  const result = JSON.parse(response.text) as ScenarioSimulationResult;

  // Compute adoption_rate_shift from actual stance data instead of trusting LLM
  if (result.initial_adoption?.length && result.final_adoption?.length) {
    const total = result.initial_adoption.length;
    const initialPositive = result.initial_adoption.filter((a) => a.stance === "positive").length;
    const finalPositive = result.final_adoption.filter((a) => a.stance === "positive").length;
    result.adoption_rate_shift = Math.round(((finalPositive - initialPositive) / total) * 100);
  }

  return result;
}
