import type { LLMAdapter, LLMRequest, LLMResponse } from "./adapter.js";
import { log } from "../utils/logger.js";

export interface FallbackEntry {
  model: string;
  adapter: LLMAdapter;
}

const PERMANENT_ERROR_PATTERNS = [
  /AllocationQuota/i,
  /FreeTier/i,
  /model.*not.*(found|exist|available)/i,
  /InvalidParameter.*model/i,
  /\(403\)/,
  /\(404\)/,
];

const FALLBACKABLE_ERROR_PATTERNS = [
  /\(403\)/,
  /\(404\)/,
  /\(408\)/,
  /\(409\)/,
  /\(429\)/,
  /\(5\d\d\)/,
  /AllocationQuota/i,
  /FreeTier/i,
  /rate.?limit/i,
  /throttl/i,
  /quota/i,
  /model.*not.*(found|exist|available)/i,
  /InvalidParameter.*model/i,
  /timeout/i,
];

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function isPermanentError(err: unknown): boolean {
  const msg = errorMessage(err);
  return PERMANENT_ERROR_PATTERNS.some((p) => p.test(msg));
}

function isFallbackable(err: unknown): boolean {
  const msg = errorMessage(err);
  return FALLBACKABLE_ERROR_PATTERNS.some((p) => p.test(msg));
}

export class FallbackLLM implements LLMAdapter {
  private blockedModels = new Set<string>();

  constructor(private entries: FallbackEntry[]) {
    if (entries.length === 0) {
      throw new Error("FallbackLLM requires at least one entry");
    }
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const candidates = this.entries.filter((e) => !this.blockedModels.has(e.model));
    if (candidates.length === 0) {
      throw new Error(
        `All fallback models blocked: ${[...this.blockedModels].join(", ")}`
      );
    }

    let lastError: unknown;
    for (let i = 0; i < candidates.length; i++) {
      const { model, adapter } = candidates[i];
      try {
        return await adapter.complete(request);
      } catch (err) {
        lastError = err;
        const permanent = isPermanentError(err);
        if (permanent) {
          this.blockedModels.add(model);
        }
        const hasMore = i < candidates.length - 1;
        if (!hasMore || !isFallbackable(err)) {
          throw err;
        }
        log.warn("llm.fallback", {
          failedModel: model,
          nextModel: candidates[i + 1].model,
          permanent,
          errorMessage: errorMessage(err).slice(0, 200),
        });
      }
    }
    throw lastError;
  }
}
