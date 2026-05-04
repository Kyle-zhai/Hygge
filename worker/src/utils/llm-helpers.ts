import { LLMTruncatedError, type LLMAdapter, type LLMResponse } from "../llm/adapter.js";
import { robustJsonParse } from "./json-parse.js";

export interface RetryBudget {
  base: number;
  retry: number;
}

/**
 * Call LLM with auto-retry on truncation. On retry failure, surface whether
 * the failure was provider-side cap (HTTP 4xx) or genuine output overflow
 * (still LLMTruncatedError at retry budget) so ops can decide next move.
 */
export async function completeWithTruncationRetry(
  llm: LLMAdapter,
  request: { system: string; prompt: string; jsonMode?: boolean },
  context: string,
  budget: RetryBudget,
): Promise<LLMResponse> {
  try {
    return await llm.complete({ ...request, maxTokens: budget.base });
  } catch (e) {
    if (!(e instanceof LLMTruncatedError)) throw e;
    console.log(
      `[${context}] Truncated at ${budget.base} tokens (output=${e.outputTokens}) — retrying with ${budget.retry}`,
    );
    try {
      return await llm.complete({ ...request, maxTokens: budget.retry });
    } catch (retryErr) {
      if (retryErr instanceof LLMTruncatedError) {
        throw new Error(
          `[${context}] Output exceeds gateway/model max even at max_tokens=${budget.retry} (outputTokens=${retryErr.outputTokens}). Output is genuinely too large — split into multiple LLM calls.`,
          { cause: retryErr },
        );
      }
      if (retryErr instanceof Error && /LLM API error \(4\d\d\)/.test(retryErr.message)) {
        throw new Error(
          `[${context}] Provider rejected max_tokens=${budget.retry} (HTTP 4xx) — gateway/model caps below ${budget.retry}. Lower retry budget or split. Underlying: ${retryErr.message}`,
          { cause: retryErr },
        );
      }
      throw retryErr;
    }
  }
}

/**
 * Call LLM with truncation retry, then parse JSON. On parse failure, retry
 * the LLM once with the parser error embedded and a strict-JSON instruction.
 * LLMs occasionally emit malformed JSON (smart quotes, trailing commas,
 * single quotes on keys) that even robustJsonParse can't always rescue —
 * a re-prompt with the parser error almost always recovers it.
 */
export async function completeAndParseJson<T = Record<string, unknown>>(
  llm: LLMAdapter,
  request: { system: string; prompt: string },
  context: string,
  budget: RetryBudget,
): Promise<T> {
  const response = await completeWithTruncationRetry(
    llm,
    { ...request, jsonMode: true },
    context,
    budget,
  );
  try {
    return robustJsonParse<T>(response.text);
  } catch (firstErr) {
    const errMsg = (firstErr as Error).message;
    console.warn(
      `[${context}] JSON parse failed on first attempt: ${errMsg.slice(0, 300)}. Raw text (first 800 chars):`,
      response.text.slice(0, 800),
    );
    const retryPrompt = `${request.prompt}\n\n---\n\nYour previous response had INVALID JSON (parser error: ${errMsg.slice(0, 200)}). Regenerate the response with these strict requirements:\n- Every property name MUST be in straight ASCII double quotes (")\n- NO trailing commas before } or ]\n- NO markdown code fences\n- NO comments or explanatory prose outside the JSON\n- Output JSON ONLY — the entire response must be parseable by JSON.parse() on the first try.`;
    const retryResponse = await completeWithTruncationRetry(
      llm,
      { system: request.system, prompt: retryPrompt, jsonMode: true },
      `${context}-Retry`,
      budget,
    );
    try {
      return robustJsonParse<T>(retryResponse.text);
    } catch (secondErr) {
      console.error(
        `[${context}] JSON parse failed AFTER retry. Retry raw text (first 800 chars):`,
        retryResponse.text.slice(0, 800),
      );
      throw new Error(
        `${context} JSON parse failed after retry: ${(secondErr as Error).message}`,
        { cause: secondErr },
      );
    }
  }
}
