import type { LLMAdapter, LLMRequest, LLMResponse } from "./adapter.js";
import { log } from "../utils/logger.js";

export interface FallbackEntry {
  providerType: string;
  baseURL?: string;
  model: string;
  adapter: LLMAdapter;
}

const PERMANENT_ERROR_PATTERNS = [
  /AllocationQuota/i,
  /FreeTier/i,
  /model.*not.*(found|exist|available)/i,
  /InvalidParameter.*model/i,
  /\(401\)/,
  /\(403\)/,
  /\(404\)/,
];

const FALLBACKABLE_ERROR_PATTERNS = [
  /\(401\)/,
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

function entryKey(e: Pick<FallbackEntry, "providerType" | "baseURL" | "model">): string {
  return `${e.providerType}|${e.baseURL ?? ""}|${e.model}`;
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
  private blockedKeys = new Set<string>();

  constructor(private entries: FallbackEntry[]) {
    if (entries.length === 0) {
      throw new Error("FallbackLLM requires at least one entry");
    }
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const candidates = this.entries.filter((e) => !this.blockedKeys.has(entryKey(e)));
    if (candidates.length === 0) {
      throw new Error(
        `All fallback entries blocked: ${[...this.blockedKeys].join(", ")}`,
      );
    }

    let lastError: unknown;
    for (let i = 0; i < candidates.length; i++) {
      const entry = candidates[i];
      try {
        return await entry.adapter.complete(request);
      } catch (err) {
        lastError = err;
        const permanent = isPermanentError(err);
        if (permanent) {
          this.blockedKeys.add(entryKey(entry));
        }
        const hasMore = i < candidates.length - 1;
        if (!hasMore || !isFallbackable(err)) {
          throw err;
        }
        const next = candidates[i + 1];
        log.warn("llm.fallback", {
          failedProvider: entry.providerType,
          failedBaseURL: entry.baseURL,
          failedModel: entry.model,
          nextProvider: next.providerType,
          nextBaseURL: next.baseURL,
          nextModel: next.model,
          permanent,
          errorMessage: errorMessage(err).slice(0, 200),
        });
      }
    }
    throw lastError;
  }
}
