import type { LLMAdapter } from "../llm/adapter.js";
import type { ProjectParsedData } from "@shared/types/evaluation.js";
import { PARSE_PROJECT_SYSTEM, buildParseProjectPrompt } from "../prompts/parse-project.js";

export async function parseProject(
  llm: LLMAdapter,
  rawInput: string,
  url?: string
): Promise<ProjectParsedData> {
  const response = await llm.complete({
    system: PARSE_PROJECT_SYSTEM,
    prompt: buildParseProjectPrompt(rawInput, url),
    maxTokens: 1024,
  });
  return JSON.parse(response.text) as ProjectParsedData;
}
