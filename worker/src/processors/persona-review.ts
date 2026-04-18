import { writeFileSync } from "node:fs";
import type { LLMAdapter } from "../llm/adapter.js";
import type { Persona } from "../types/persona.js";
import type { EvaluationScores, ProjectParsedData, TopicClassification, PersonaStance, CitedReference } from "../types/evaluation.js";
import { buildPersonaReviewPrompt } from "../prompts/persona-review.js";
import { config } from "../config.js";
import { robustJsonParse } from "../utils/json-parse.js";
import { validatePersonaReview, hasReviewViolations, buildReviewRetryInstructions } from "../utils/review-validator.js";
import { isShortTopicQuery } from "../utils/topic-mode.js";

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
  const parseResponse = (text: string): any => {
    try {
      return robustJsonParse(text);
    } catch (e) {
      try {
        const dumpPath = `/tmp/persona-review-fail-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.txt`;
        writeFileSync(dumpPath, text);
        console.error(`[PersonaReview:${persona.identity.name}] JSON parse failed. Full response at ${dumpPath}. First 300:`, text.slice(0, 300));
      } catch {
        console.error(`[PersonaReview:${persona.identity.name}] JSON parse failed. First 300:`, text.slice(0, 300));
      }
      throw new Error(`Persona review JSON parse failed for ${persona.identity.name}: ${(e as Error).message}`);
    }
  };

  const validatorOpts = { skipSubmissionQuoteChecks: isShortTopicQuery(mode, rawInput) };
  const MAX_RETRIES = 2;
  let response = await llm.complete({ system, prompt, maxTokens: 2048, jsonMode: true });
  let parsed = parseResponse(response.text);
  let validation = validatePersonaReview(parsed, rawInput);
  for (let attempt = 1; attempt <= MAX_RETRIES && hasReviewViolations(validation, validatorOpts); attempt++) {
    console.log(
      `[PersonaReview:${persona.identity.name}] Retry ${attempt}/${MAX_RETRIES} — banned:${validation.bannedHits.length} fabricated:${validation.fabricatedQuotes.length} invalidExtracted:${validation.invalidExtractedQuotes.length} extractedCount:${validation.extractedCount} verbatimReviewCount:${validation.verbatimReviewCount} unused:${validation.unusedExtractedQuotes.length} shortTopic:${validatorOpts.skipSubmissionQuoteChecks}`
    );
    const retryInstructions = buildReviewRetryInstructions(validation, validatorOpts);
    const retryTail = validatorOpts.skipSubmissionQuoteChecks
      ? "Regenerate the ENTIRE JSON response now, addressing every issue above. Keep the same exact schema. Keep extracted_quotes as an empty array."
      : "Regenerate the ENTIRE JSON response now, addressing every issue above. Keep the same exact schema. Keep extracted_quotes populated with 3-5 verbatim fragments from the submission.";
    const retryPrompt = `${prompt}\n\n---\n\nATTEMPT ${attempt} FAILED VALIDATION. You MUST fix these specific issues:\n\n${retryInstructions}\n\n${retryTail}`;
    response = await llm.complete({ system, prompt: retryPrompt, maxTokens: 2048, jsonMode: true });
    parsed = parseResponse(response.text);
    validation = validatePersonaReview(parsed, rawInput);
  }
  if (hasReviewViolations(validation, validatorOpts)) {
    console.log(
      `[PersonaReview:${persona.identity.name}] Retries exhausted — proceeding with residual violations: banned:${validation.bannedHits.length} fabricated:${validation.fabricatedQuotes.length} extractedCount:${validation.extractedCount} verbatimReviewCount:${validation.verbatimReviewCount}`
    );
  }
  const scores = (dimensions && mode === "topic") ? (parsed.stances ?? parsed.scores) : parsed.scores;
  if (!scores || typeof scores !== "object") {
    throw new Error(`Persona review for ${persona.identity.name} returned no scores`);
  }
  return {
    scores,
    review_text: parsed.review_text,
    strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
    weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [],
    llm_model: config.llm.model,
    overall_stance: parsed.overall_stance ?? null,
    cited_references: Array.isArray(parsed.cited_references) ? parsed.cited_references : null,
  };
}
