import { config } from "../config.js";
import type { LLMAdapter } from "./adapter.js";
import { OpenAICompatibleLLM } from "./openai-compatible.js";
import { AnthropicLLM } from "./anthropic.js";
import { GoogleLLM } from "./google.js";

export type LLMProviderType = "openai_compatible" | "anthropic" | "google";

export interface LLMOverrides {
  providerType?: LLMProviderType;
  apiKey: string;
  baseURL?: string;
  model: string;
  visionModel?: string;
}

function isValid(overrides: LLMOverrides | undefined | null): overrides is LLMOverrides {
  if (!overrides || !overrides.apiKey || !overrides.model) return false;
  const provider = overrides.providerType ?? "openai_compatible";
  if (provider === "openai_compatible") {
    return !!overrides.baseURL;
  }
  return true;
}

function buildAdapter(
  providerType: LLMProviderType,
  apiKey: string,
  model: string,
  baseURL?: string,
): LLMAdapter {
  switch (providerType) {
    case "anthropic":
      return new AnthropicLLM(apiKey, model, baseURL);
    case "google":
      return new GoogleLLM(apiKey, model, baseURL);
    case "openai_compatible":
    default:
      if (!baseURL) {
        throw new Error("openai_compatible provider requires a baseURL");
      }
      return new OpenAICompatibleLLM(apiKey, model, baseURL);
  }
}

export function buildLLM(overrides?: LLMOverrides | null): LLMAdapter {
  if (isValid(overrides)) {
    return buildAdapter(
      overrides.providerType ?? "openai_compatible",
      overrides.apiKey,
      overrides.model,
      overrides.baseURL,
    );
  }
  return new OpenAICompatibleLLM(config.llm.apiKey, config.llm.model, config.llm.baseURL);
}

export function buildVisionLLM(overrides?: LLMOverrides | null): LLMAdapter {
  if (isValid(overrides)) {
    const model = overrides.visionModel || overrides.model;
    return buildAdapter(
      overrides.providerType ?? "openai_compatible",
      overrides.apiKey,
      model,
      overrides.baseURL,
    );
  }
  return new OpenAICompatibleLLM(config.llm.apiKey, config.llm.visionModel, config.llm.baseURL);
}
