import Anthropic from "@anthropic-ai/sdk";
import type { LLMAdapter, LLMRequest, LLMResponse } from "./adapter.js";

export class ClaudeLLM implements LLMAdapter {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: request.maxTokens ?? 4096,
      system: request.system,
      messages: [{ role: "user", content: request.prompt }],
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");

    return {
      text,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  }
}
