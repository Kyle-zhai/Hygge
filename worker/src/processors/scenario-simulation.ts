import type { LLMAdapter } from "../llm/adapter.js";
import type { PersonaReview } from "../../shared/types/evaluation.js";
import type { Persona } from "../../shared/types/persona.js";
import type { ScenarioSimulationResult } from "../../shared/types/report.js";
import { buildScenarioSimulationPrompt } from "../prompts/scenario-simulation.js";

export async function runScenarioSimulation(
  llm: LLMAdapter,
  personas: Persona[],
  reviews: (PersonaReview & { persona_name: string })[]
): Promise<ScenarioSimulationResult> {
  const { system, prompt } = buildScenarioSimulationPrompt(personas, reviews);
  const response = await llm.complete({ system, prompt, maxTokens: 4096 });
  return JSON.parse(response.text) as ScenarioSimulationResult;
}
