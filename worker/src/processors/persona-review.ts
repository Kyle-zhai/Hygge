import type { LLMAdapter } from "../llm/adapter.js";
import type { Persona } from "../types/persona.js";
import type { EvaluationScores, ProjectParsedData, TopicClassification, PersonaStance, CitedReference } from "../types/evaluation.js";
import { buildPersonaReviewPrompt } from "../prompts/persona-review.js";
import { config } from "../config.js";

export interface PersonaReviewResult {
  scores: EvaluationScores;
  review_text: string;
  strengths: string[];
  weaknesses: string[];
  llm_model: string;
  overall_stance?: PersonaStance | null;
  cited_references?: CitedReference[] | null;
}

/** Generate a single persona's perspective on the given topic. */
export async function generatePersonaReview(
  llm: LLMAdapter,
  persona: Persona,
  project: ProjectParsedData,
  rawInput: string,
  dimensions?: TopicClassification["dimensions"],
  mode?: "product" | "topic"
): Promise<PersonaReviewResult> {
  const { system, prompt } = buildPersonaReviewPrompt(persona, project, rawInput, dimensions, mode);
  const response = await llm.complete({ system, prompt, maxTokens: 2048 });
  let parsed: any;
  try {
    parsed = JSON.parse(response.text);
  } catch (e) {
    console.error(`[PersonaReview:${persona.identity.name}] JSON parse failed. Raw text (first 300 chars):`, response.text.slice(0, 300));
    throw new Error(`Persona review JSON parse failed for ${persona.identity.name}: ${(e as Error).message}`);
  }
  const scores = (dimensions && mode === "topic") ? (parsed.stances ?? parsed.scores) : parsed.scores;
  if (!scores || typeof scores !== "object") {
    throw new Error(`Persona review for ${persona.identity.name} returned no scores`);
  }
  return {
    scores,
    review_text: parsed.review_text,
    strengths: parsed.strengths,
    weaknesses: parsed.weaknesses,
    llm_model: config.llm.model,
    overall_stance: parsed.overall_stance ?? null,
    cited_references: Array.isArray(parsed.cited_references) ? parsed.cited_references : null,
  };
}
