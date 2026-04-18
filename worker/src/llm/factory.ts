import { config, type ChainEntry, type ProviderType } from "../config.js";
import type { LLMAdapter } from "./adapter.js";
import { OpenAICompatibleLLM } from "./openai-compatible.js";
import { AnthropicLLM } from "./anthropic.js";
import { GoogleLLM } from "./google.js";
import { FallbackLLM, type FallbackEntry } from "./fallback.js";

export type { ProviderType } from "../config.js";

export interface LLMOverrideEntry {
  providerType?: ProviderType;
  apiKey: string;
  baseURL?: string;
  model: string;
  visionModel?: string;
  label?: string;
}

// Backwards-compat: API routes used to send a single object; worker still accepts
// either a single entry or an array so in-flight jobs enqueued before the rollout
// don't crash on the shape change.
export type LLMOverrides = LLMOverrideEntry | LLMOverrideEntry[];

function toEntryArray(overrides: LLMOverrides | undefined | null): LLMOverrideEntry[] {
  if (!overrides) return [];
  return Array.isArray(overrides) ? overrides : [overrides];
}

function isValidEntry(e: LLMOverrideEntry): boolean {
  if (!e.apiKey || !e.model) return false;
  const provider = e.providerType ?? "openai_compatible";
  if (provider === "openai_compatible") return !!e.baseURL;
  return true;
}

function buildAdapter(entry: ChainEntry): LLMAdapter {
  switch (entry.providerType) {
    case "anthropic":
      return new AnthropicLLM(entry.apiKey, entry.model, entry.baseURL);
    case "google":
      return new GoogleLLM(entry.apiKey, entry.model, entry.baseURL);
    case "openai_compatible":
    default:
      if (!entry.baseURL) {
        throw new Error(`openai_compatible entry (${entry.model}) requires a baseURL`);
      }
      return new OpenAICompatibleLLM(entry.apiKey, entry.model, entry.baseURL);
  }
}

function toChainEntry(e: LLMOverrideEntry): ChainEntry {
  return {
    providerType: e.providerType ?? "openai_compatible",
    apiKey: e.apiKey,
    baseURL: e.baseURL,
    model: e.model,
    visionModel: e.visionModel,
    label: e.label,
  };
}

function resolveChain(overrides: LLMOverrides | undefined | null): ChainEntry[] {
  const userEntries = toEntryArray(overrides).filter(isValidEntry).map(toChainEntry);
  if (userEntries.length > 0) return userEntries;
  if (config.llm.chain.length === 0) {
    throw new Error(
      "No LLM chain configured. Set LLM_1_PROVIDER/LLM_1_API_KEY/LLM_1_MODEL (and LLM_1_BASE_URL for openai_compatible) on the worker, or save a chain in /settings/llm.",
    );
  }
  return config.llm.chain;
}

function buildFallbackFrom(chain: ChainEntry[]): LLMAdapter {
  const entries: FallbackEntry[] = chain.map((c) => ({
    providerType: c.providerType,
    baseURL: c.baseURL,
    model: c.model,
    adapter: buildAdapter(c),
  }));
  return new FallbackLLM(entries);
}

export function buildLLM(overrides?: LLMOverrides | null): LLMAdapter {
  return buildFallbackFrom(resolveChain(overrides));
}

export function buildVisionLLM(overrides?: LLMOverrides | null): LLMAdapter {
  const chain = resolveChain(overrides);
  const visionChain = chain
    .filter((c) => !!c.visionModel)
    .map<ChainEntry>((c) => ({ ...c, model: c.visionModel as string }));
  if (visionChain.length > 0) return buildFallbackFrom(visionChain);
  // No entry declared vision capability — fall back to the primary chain so callers
  // still get something rather than crashing. Quality may degrade but the job runs.
  return buildFallbackFrom(chain);
}
