import { writeFileSync } from "node:fs";
import { LLMTruncatedError, type LLMAdapter } from "../llm/adapter.js";
import type { Persona } from "../types/persona.js";
import type { EvaluationScores, ProjectParsedData, TopicClassification, PersonaStance, CitedReference } from "../types/evaluation.js";
import { buildPersonaReviewPrompt } from "../prompts/persona-review.js";
import { robustJsonParse } from "../utils/json-parse.js";
import { validatePersonaReview, hasReviewViolations, buildReviewRetryInstructions } from "../utils/review-validator.js";
import { isShortTopicQuery } from "../utils/topic-mode.js";

const BASE_MAX_TOKENS = 4096;
const RETRY_MAX_TOKENS = 6144;

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
  const dumpFailure = (text: string, message: string) => {
    try {
      const dumpPath = `/tmp/persona-review-fail-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.txt`;
      writeFileSync(dumpPath, text);
      console.error(`[PersonaReview:${persona.identity.name}] ${message}. Full response at ${dumpPath}. First 300:`, text.slice(0, 300));
    } catch {
      console.error(`[PersonaReview:${persona.identity.name}] ${message}. First 300:`, text.slice(0, 300));
    }
  };

  const tryComplete = async (
    activePrompt: string,
    maxTokens: number,
  ): Promise<{ response: Awaited<ReturnType<typeof llm.complete>>; parsed: Record<string, unknown> } | { truncated: true; partialText: string }> => {
    let response;
    try {
      response = await llm.complete({ system, prompt: activePrompt, maxTokens, jsonMode: true });
    } catch (e) {
      if (e instanceof LLMTruncatedError) {
        return { truncated: true, partialText: e.partialText };
      }
      throw e;
    }
    try {
      const parsed = robustJsonParse(response.text) as Record<string, unknown>;
      return { response, parsed };
    } catch (e) {
      dumpFailure(response.text, `JSON parse failed: ${(e as Error).message}`);
      return { truncated: true, partialText: response.text };
    }
  };

  const validatorOpts = { skipSubmissionQuoteChecks: isShortTopicQuery(mode, rawInput) };
  const MAX_RETRIES = 2;

  let attempt = 0;
  let outcome = await tryComplete(prompt, BASE_MAX_TOKENS);
  // Recovery loop: retry once with a higher token budget if the first call was
  // truncated or unparseable, then fall through to validation retries.
  while ("truncated" in outcome && attempt < MAX_RETRIES) {
    attempt++;
    console.log(
      `[PersonaReview:${persona.identity.name}] Recovery retry ${attempt}/${MAX_RETRIES} — bumping maxTokens to ${RETRY_MAX_TOKENS}`,
    );
    outcome = await tryComplete(prompt, RETRY_MAX_TOKENS);
  }
  if ("truncated" in outcome) {
    throw new Error(`Persona review failed for ${persona.identity.name}: response truncated/unparseable after ${MAX_RETRIES} retries`);
  }

  let response = outcome.response;
  let parsed = outcome.parsed;
  let validation = validatePersonaReview(parsed, rawInput);
  for (; attempt < MAX_RETRIES && hasReviewViolations(validation, validatorOpts); attempt++) {
    console.log(
      `[PersonaReview:${persona.identity.name}] Validation retry ${attempt + 1}/${MAX_RETRIES} — banned:${validation.bannedHits.length} fabricated:${validation.fabricatedQuotes.length} invalidExtracted:${validation.invalidExtractedQuotes.length} extractedCount:${validation.extractedCount} verbatimReviewCount:${validation.verbatimReviewCount} unused:${validation.unusedExtractedQuotes.length} shortTopic:${validatorOpts.skipSubmissionQuoteChecks}`,
    );
    const retryInstructions = buildReviewRetryInstructions(validation, validatorOpts);
    const retryTail = validatorOpts.skipSubmissionQuoteChecks
      ? "Regenerate the ENTIRE JSON response now, addressing every issue above. Keep the same exact schema. Keep extracted_quotes as an empty array."
      : "Regenerate the ENTIRE JSON response now, addressing every issue above. Keep the same exact schema. Keep extracted_quotes populated with 3-5 verbatim fragments from the submission.";
    const retryPrompt = `${prompt}\n\n---\n\nATTEMPT ${attempt + 1} FAILED VALIDATION. You MUST fix these specific issues:\n\n${retryInstructions}\n\n${retryTail}`;
    const retryOutcome = await tryComplete(retryPrompt, RETRY_MAX_TOKENS);
    if ("truncated" in retryOutcome) {
      console.log(`[PersonaReview:${persona.identity.name}] Validation retry truncated — keeping previous parsed result`);
      break;
    }
    response = retryOutcome.response;
    parsed = retryOutcome.parsed;
    validation = validatePersonaReview(parsed, rawInput);
  }
  if (hasReviewViolations(validation, validatorOpts)) {
    console.log(
      `[PersonaReview:${persona.identity.name}] Retries exhausted — proceeding with residual violations: banned:${validation.bannedHits.length} fabricated:${validation.fabricatedQuotes.length} extractedCount:${validation.extractedCount} verbatimReviewCount:${validation.verbatimReviewCount}`,
    );
  }
  const scoresCandidate = (dimensions && mode === "topic") ? (parsed.stances ?? parsed.scores) : parsed.scores;
  if (!scoresCandidate || typeof scoresCandidate !== "object") {
    throw new Error(`Persona review for ${persona.identity.name} returned no scores`);
  }
  return {
    scores: scoresCandidate as EvaluationScores,
    review_text: typeof parsed.review_text === "string" ? parsed.review_text : "",
    strengths: Array.isArray(parsed.strengths) ? (parsed.strengths as string[]) : [],
    weaknesses: Array.isArray(parsed.weaknesses) ? (parsed.weaknesses as string[]) : [],
    llm_model: response.model,
    overall_stance: (parsed.overall_stance ?? null) as PersonaStance | null,
    cited_references: Array.isArray(parsed.cited_references) ? (parsed.cited_references as CitedReference[]) : null,
  };
}
