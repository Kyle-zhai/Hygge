import type { LLMAdapter, MediaItem } from "../llm/adapter.js";
import type { ProjectParsedData } from "../types/evaluation.js";
import { PARSE_PROJECT_SYSTEM, buildParseProjectPrompt } from "../prompts/parse-project.js";

/** Parse the user's submission to extract structured topic data for persona discussion. */
export async function parseProject(
  llm: LLMAdapter,
  rawInput: string,
  url?: string,
  attachmentDescriptions?: string[],
  media?: MediaItem[]
): Promise<ProjectParsedData> {
  const response = await llm.complete({
    system: PARSE_PROJECT_SYSTEM,
    prompt: buildParseProjectPrompt(rawInput, url, attachmentDescriptions),
    media: media?.length ? media : undefined,
    maxTokens: 1024,
  });
  return JSON.parse(response.text) as ProjectParsedData;
}
