import type { LLMAdapter } from "../llm/adapter.js";
import type { Persona } from "../types/persona.js";
import type { EvaluationScores } from "../types/evaluation.js";
import type { OpinionDriftEntry } from "../types/report.js";
import { robustJsonParse } from "../utils/json-parse.js";
import { buildOpinionDriftPrompt } from "../prompts/opinion-drift.js";

export type { OpinionDriftEntry };

interface ReviewForDrift {
  persona_id: string;
  persona_name: string;
  scores: EvaluationScores;
  review_text: string;
  strengths: string[];
  weaknesses: string[];
}

export async function generateOpinionDrift(
  llm: LLMAdapter,
  personas: Persona[],
  reviews: ReviewForDrift[],
): Promise<OpinionDriftEntry[]> {
  if (reviews.length < 2) return [];

  const { system, prompt, initialLeanings } = buildOpinionDriftPrompt(personas, reviews);
  const response = await llm.complete({ system, prompt, maxTokens: 2048, jsonMode: true });

  let parsed: { drifts?: OpinionDriftEntry[] };
  try {
    parsed = robustJsonParse(response.text);
  } catch (e) {
    console.error(`[OpinionDrift] JSON parse failed. Raw (first 300 chars):`, response.text.slice(0, 300));
    return [];
  }

  const drifts = Array.isArray(parsed.drifts) ? parsed.drifts : [];
  // Enforce the computed initial_leaning — the LLM is there only for the final leaning + narrative.
  return drifts.map((d) => ({
    ...d,
    initial_leaning: (initialLeanings[d.persona_id] as OpinionDriftEntry["initial_leaning"]) ?? d.initial_leaning,
  }));
}
