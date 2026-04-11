import type { LLMAdapter } from "../llm/adapter.js";
import type { Persona } from "../types/persona.js";
import type { EvaluationScores, ProjectParsedData, TopicClassification } from "../types/evaluation.js";
import { buildPersonaReviewPrompt } from "../prompts/persona-review.js";
import { config } from "../config.js";

export interface PersonaReviewResult {
  scores: EvaluationScores;
  review_text: string;
  strengths: string[];
  weaknesses: string[];
  llm_model: string;
}

/** Generate a single persona's perspective on the given topic. */
export async function generatePersonaReview(
  llm: LLMAdapter,
  persona: Persona,
  project: ProjectParsedData,
  rawInput: string,
  dimensions?: TopicClassification["dimensions"]
): Promise<PersonaReviewResult> {
  const { system, prompt } = buildPersonaReviewPrompt(persona, project, rawInput, dimensions);
  const response = await llm.complete({ system, prompt, maxTokens: 2048 });
  const parsed = JSON.parse(response.text);
  // Topic mode returns stances, product mode returns numerical scores
  const scores = dimensions ? (parsed.stances ?? parsed.scores) : parsed.scores;
  return {
    scores,
    review_text: parsed.review_text,
    strengths: parsed.strengths,
    weaknesses: parsed.weaknesses,
    llm_model: config.llm.model,
  };
}
