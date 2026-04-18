import type { LLMAdapter, LLMRequest, LLMResponse } from "./adapter.js";
import { log } from "../utils/logger.js";
import { config } from "../config.js";

const DEFAULT_ANTHROPIC_URL = "https://api.anthropic.com";

export class AnthropicLLM implements LLMAdapter {
  constructor(
    private apiKey: string,
    private model: string,
    private baseURL?: string,
  ) {}

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const started = Date.now();
    const promptChars = (request.system?.length ?? 0) + (request.prompt?.length ?? 0);
    const url = `${this.baseURL || DEFAULT_ANTHROPIC_URL}/v1/messages`;

    const content: unknown[] = [];
    if (request.media?.length) {
      for (const item of request.media) {
        if (item.type === "image") {
          content.push({ type: "image", source: { type: "url", url: item.url } });
        } else {
          content.push({ type: "text", text: `[video reference: ${item.url}]` });
        }
      }
    }
    content.push({ type: "text", text: request.prompt });

    const systemPrompt = request.jsonMode
      ? `${request.system}\n\nRespond with a single valid JSON object. Do not wrap it in markdown fences.`
      : request.system;

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: request.maxTokens ?? 4096,
          system: systemPrompt,
          messages: [{ role: "user", content }],
        }),
        signal: AbortSignal.timeout(config.llm.timeoutMs),
      });
    } catch (err) {
      const timedOut = err instanceof DOMException && err.name === "TimeoutError";
      log.error(timedOut ? "llm.timeout" : "llm.network_error", {
        provider: "anthropic",
        model: this.model,
        durationMs: Date.now() - started,
        timeoutMs: config.llm.timeoutMs,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }

    if (!response.ok) {
      const errText = await response.text();
      log.error("llm.http_error", {
        provider: "anthropic",
        model: this.model,
        status: response.status,
        durationMs: Date.now() - started,
        promptChars,
        errorBody: errText.slice(0, 500),
      });
      throw new Error(`Anthropic API error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    let text = "";
    for (const block of data.content ?? []) {
      if (block?.type === "text" && typeof block.text === "string") text += block.text;
    }

    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) text = fenceMatch[1].trim();
    text = text.replace(/[\x00-\x1F\x7F]/g, (ch: string) =>
      ch === "\n" || ch === "\r" || ch === "\t" ? " " : "",
    );

    const inputTokens = data.usage?.input_tokens ?? 0;
    const outputTokens = data.usage?.output_tokens ?? 0;

    log.info("llm.complete", {
      provider: "anthropic",
      model: this.model,
      durationMs: Date.now() - started,
      inputTokens,
      outputTokens,
      promptChars,
      outputChars: text.length,
      jsonMode: !!request.jsonMode,
      hasMedia: !!request.media?.length,
      maxTokens: request.maxTokens ?? 4096,
    });

    return { text, model: this.model, usage: { inputTokens, outputTokens } };
  }
}
