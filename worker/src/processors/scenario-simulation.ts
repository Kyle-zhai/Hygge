import type { LLMAdapter } from "../llm/adapter.js";
import type { EvaluationScores } from "../types/evaluation.js";
import type { Persona } from "../types/persona.js";
import type { ScenarioSimulationResult } from "../types/report.js";
import { buildScenarioSimulationPrompt } from "../prompts/scenario-simulation.js";

export interface ReviewForSimulation {
  persona_id: string;
  persona_name: string;
  scores: EvaluationScores;
}

/** Simulate social dynamics among personas discussing the topic. */
export async function runScenarioSimulation(
  llm: LLMAdapter,
  personas: Persona[],
  reviews: ReviewForSimulation[]
): Promise<ScenarioSimulationResult> {
  const { system, prompt } = buildScenarioSimulationPrompt(personas, reviews);
  const response = await llm.complete({ system, prompt, maxTokens: 4096 });
  return JSON.parse(response.text) as ScenarioSimulationResult;
}
