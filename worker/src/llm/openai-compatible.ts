import type { LLMAdapter, LLMRequest, LLMResponse } from "./adapter.js";

export class OpenAICompatibleLLM implements LLMAdapter {
  private apiKey: string;
  private model: string;
  private baseURL: string;

  constructor(apiKey: string, model: string, baseURL: string) {
    this.apiKey = apiKey;
    this.model = model;
    this.baseURL = baseURL;
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 180_000);

    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: this.model,
        max_tokens: request.maxTokens ?? 4096,
        messages: [
          { role: "system", content: request.system },
          { role: "user", content: request.prompt },
        ],
      }),
    }).finally(() => clearTimeout(timeout));

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`LLM API error (${response.status}): ${err}`);
    }

    const data = await response.json();
    let text = data.choices?.[0]?.message?.content ?? "";

    // Strip markdown code fences if present (e.g. ```json ... ```)
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
      text = fenceMatch[1].trim();
    }

    // Sanitize control characters that break JSON.parse
    text = text.replace(/[\x00-\x1F\x7F]/g, (ch: string) => {
      if (ch === "\n" || ch === "\r" || ch === "\t") return " ";
      return "";
    });

    return {
      text,
      usage: {
        inputTokens: data.usage?.prompt_tokens ?? 0,
        outputTokens: data.usage?.completion_tokens ?? 0,
      },
    };
  }
}
