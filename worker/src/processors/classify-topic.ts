import type { LLMAdapter } from "../llm/adapter.js";
import type { TopicClassification } from "../types/evaluation.js";
import {
  CLASSIFY_TOPIC_SYSTEM,
  CLASSIFY_TOPIC_SHORT_SYSTEM,
  buildClassifyTopicPrompt,
  buildClassifyTopicShortPrompt,
} from "../prompts/classify-topic.js";
import { robustJsonParse } from "../utils/json-parse.js";
import { findGenericDimensions } from "../utils/review-validator.js";
import { isShortTopicQuery } from "../utils/topic-mode.js";

/** Classify the topic and generate tailored evaluation dimensions. */
export async function classifyTopic(
  llm: LLMAdapter,
  rawInput: string,
  mode?: "product" | "topic",
): Promise<TopicClassification> {
  const short = isShortTopicQuery(mode, rawInput);
  const system = short ? CLASSIFY_TOPIC_SHORT_SYSTEM : CLASSIFY_TOPIC_SYSTEM;
  const basePrompt = short ? buildClassifyTopicShortPrompt(rawInput) : buildClassifyTopicPrompt(rawInput);

  const response = await llm.complete({
    system,
    prompt: basePrompt,
    maxTokens: 1024,
    jsonMode: true,
  });
  let parsed = robustJsonParse<TopicClassification>(response.text);

  // The generic-dimensions retry relies on token overlap with the submission, which
  // is meaningless for a 6-word question. Short Topic dimensions are expected to
  // target the subject via common knowledge, not verbatim elements of rawInput.
  if (!short) {
    const genericDims = findGenericDimensions(parsed.dimensions ?? [], rawInput);
    if (genericDims.length > 0) {
      const keys = genericDims.map((d) => `"${d.key}"`).join(", ");
      console.log(`[classifyTopic] Retrying — generic dimensions: ${keys}`);
      const retryPrompt = `${basePrompt}\n\n---\n\nYour previous response had these dimensions whose descriptions are TOO GENERIC: ${keys}. Each dimension's description must either (a) reference a specific number/price/metric that appears in the submission, or (b) quote specific words or proper nouns from the submission. Rewrite every dimension to be tightly grounded in the submission's actual content. Regenerate the ENTIRE JSON response now.`;
      const retryResp = await llm.complete({
        system,
        prompt: retryPrompt,
        maxTokens: 1024,
        jsonMode: true,
      });
      parsed = robustJsonParse<TopicClassification>(retryResp.text);
    }
  }

  return parsed;
}
