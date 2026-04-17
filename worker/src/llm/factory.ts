import { config } from "../config.js";
import { OpenAICompatibleLLM } from "./openai-compatible.js";

export interface LLMOverrides {
  apiKey: string;
  baseURL: string;
  model: string;
  visionModel?: string;
}

function isValid(overrides: LLMOverrides | undefined | null): overrides is LLMOverrides {
  return !!(overrides && overrides.apiKey && overrides.baseURL && overrides.model);
}

export function buildLLM(overrides?: LLMOverrides | null): OpenAICompatibleLLM {
  if (isValid(overrides)) {
    return new OpenAICompatibleLLM(overrides.apiKey, overrides.model, overrides.baseURL);
  }
  return new OpenAICompatibleLLM(config.llm.apiKey, config.llm.model, config.llm.baseURL);
}

export function buildVisionLLM(overrides?: LLMOverrides | null): OpenAICompatibleLLM {
  if (isValid(overrides)) {
    const model = overrides.visionModel || overrides.model;
    return new OpenAICompatibleLLM(overrides.apiKey, model, overrides.baseURL);
  }
  return new OpenAICompatibleLLM(config.llm.apiKey, config.llm.visionModel, config.llm.baseURL);
}
