import type { LLMAdapter } from "../llm/adapter.js";
import type { TopicClassification } from "../types/evaluation.js";
import { CLASSIFY_TOPIC_SYSTEM, buildClassifyTopicPrompt } from "../prompts/classify-topic.js";

/** Classify the topic and generate tailored evaluation dimensions. */
export async function classifyTopic(
  llm: LLMAdapter,
  rawInput: string
): Promise<TopicClassification> {
  const response = await llm.complete({
    system: CLASSIFY_TOPIC_SYSTEM,
    prompt: buildClassifyTopicPrompt(rawInput),
    maxTokens: 1024,
  });
  return JSON.parse(response.text) as TopicClassification;
}
