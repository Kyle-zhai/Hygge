import type { LLMAdapter, LLMRequest, LLMResponse } from "./adapter.js";
import { log } from "../utils/logger.js";

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
    const started = Date.now();
    const promptChars = (request.system?.length ?? 0) + (request.prompt?.length ?? 0);

    let userContent: unknown = request.prompt;

    if (request.media?.length) {
      const parts: unknown[] = [];
      for (const item of request.media) {
        if (item.type === "image") {
          parts.push({ type: "image_url", image_url: { url: item.url } });
        } else if (item.type === "video") {
          parts.push({ type: "video_url", video_url: { url: item.url } });
        }
      }
      parts.push({ type: "text", text: request.prompt });
      userContent = parts;
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseURL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: request.maxTokens ?? 4096,
          ...(request.jsonMode ? { response_format: { type: "json_object" } } : {}),
          messages: [
            { role: "system", content: request.system },
            { role: "user", content: userContent },
          ],
        }),
      });
    } catch (err) {
      log.error("llm.network_error", {
        model: this.model,
        durationMs: Date.now() - started,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }

    if (!response.ok) {
      const err = await response.text();
      log.error("llm.http_error", {
        model: this.model,
        status: response.status,
        durationMs: Date.now() - started,
        promptChars,
        errorBody: err.slice(0, 500),
      });
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

    const inputTokens = data.usage?.prompt_tokens ?? 0;
    const outputTokens = data.usage?.completion_tokens ?? 0;

    log.info("llm.complete", {
      model: this.model,
      durationMs: Date.now() - started,
      inputTokens,
      outputTokens,
      promptChars,
      outputChars: text.length,
      jsonMode: request.jsonMode ?? false,
      hasMedia: !!request.media?.length,
      maxTokens: request.maxTokens ?? 4096,
    });

    return {
      text,
      usage: {
        inputTokens,
        outputTokens,
      },
    };
  }
}
