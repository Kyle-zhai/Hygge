import type { LLMAdapter } from "../llm/adapter.js";
import type { EvaluationScores } from "@shared/types/evaluation.js";
import type { Persona } from "@shared/types/persona.js";
import type { ScenarioSimulationResult } from "@shared/types/report.js";
import { buildScenarioSimulationPrompt } from "../prompts/scenario-simulation.js";

export interface ReviewForSimulation {
  persona_id: string;
  persona_name: string;
  scores: EvaluationScores;
}

export async function runScenarioSimulation(
  llm: LLMAdapter,
  personas: Persona[],
  reviews: ReviewForSimulation[]
): Promise<ScenarioSimulationResult> {
  const { system, prompt } = buildScenarioSimulationPrompt(personas, reviews);
  const response = await llm.complete({ system, prompt, maxTokens: 4096 });
  return JSON.parse(response.text) as ScenarioSimulationResult;
}
