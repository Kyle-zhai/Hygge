import type { LLMAdapter, MediaItem } from "../llm/adapter.js";
import type { ProjectParsedData } from "../types/evaluation.js";
import {
  buildParseProjectSystem,
  buildParseProjectShortTopicSystem,
  buildParseProjectPrompt,
  buildParseProjectShortTopicPrompt,
} from "../prompts/parse-project.js";
import { robustJsonParse } from "../utils/json-parse.js";
import { isShortTopicQuery } from "../utils/topic-mode.js";
import type { ReplyLanguage } from "./language-detect.js";

/** Parse the user's submission to extract structured topic data for persona discussion. */
export async function parseProject(
  llm: LLMAdapter,
  rawInput: string,
  url?: string,
  attachmentDescriptions?: string[],
  media?: MediaItem[],
  mode?: "product" | "topic",
  replyLanguage: ReplyLanguage = "en",
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
    system: useShortTopic
      ? buildParseProjectShortTopicSystem(replyLanguage)
      : buildParseProjectSystem(replyLanguage),
    prompt: useShortTopic
      ? buildParseProjectShortTopicPrompt(rawInput)
      : buildParseProjectPrompt(rawInput, url, attachmentDescriptions),
    media: media?.length ? media : undefined,
    maxTokens: 2048,
    jsonMode: true,
  });
  const parsed = robustJsonParse<ProjectParsedData | null>(response.text);
  if (!parsed || typeof parsed !== "object") {
    throw new Error(
      `parseProject: LLM returned non-object (got ${parsed === null ? "null" : typeof parsed}). Raw text (first 300 chars): ${response.text.slice(0, 300)}`,
    );
  }
  return parsed;
}
