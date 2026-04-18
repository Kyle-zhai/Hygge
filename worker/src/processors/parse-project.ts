import type { LLMAdapter, MediaItem } from "../llm/adapter.js";
import type { ProjectParsedData } from "../types/evaluation.js";
import {
  PARSE_PROJECT_SYSTEM,
  PARSE_PROJECT_SHORT_TOPIC_SYSTEM,
  buildParseProjectPrompt,
  buildParseProjectShortTopicPrompt,
} from "../prompts/parse-project.js";
import { robustJsonParse } from "../utils/json-parse.js";
import { isShortTopicQuery } from "../utils/topic-mode.js";

/** Parse the user's submission to extract structured topic data for persona discussion. */
export async function parseProject(
  llm: LLMAdapter,
  rawInput: string,
  url?: string,
  attachmentDescriptions?: string[],
  media?: MediaItem[],
  mode?: "product" | "topic",
): Promise<ProjectParsedData> {
  // Short Topic queries ("what do you think of X?") get a briefing-about-the-subject
  // prompt instead of a critique-the-submission prompt. Attachments / URLs force the
  // submission path even in Topic mode since the user is attaching content to discuss.
  const useShortTopic =
    isShortTopicQuery(mode, rawInput) &&
    !url &&
    (!attachmentDescriptions || attachmentDescriptions.length === 0) &&
    (!media || media.length === 0);

  const response = await llm.complete({
    system: useShortTopic ? PARSE_PROJECT_SHORT_TOPIC_SYSTEM : PARSE_PROJECT_SYSTEM,
    prompt: useShortTopic
      ? buildParseProjectShortTopicPrompt(rawInput)
      : buildParseProjectPrompt(rawInput, url, attachmentDescriptions),
    media: media?.length ? media : undefined,
    maxTokens: 2048,
    jsonMode: true,
  });
  return robustJsonParse<ProjectParsedData>(response.text);
}
