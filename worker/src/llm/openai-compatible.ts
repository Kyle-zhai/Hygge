import { LLMTruncatedError, type LLMAdapter, type LLMRequest, type LLMResponse } from "./adapter.js";
import { log } from "../utils/logger.js";
import { config } from "../config.js";

interface StreamChoice {
  delta?: { content?: string };
  finish_reason?: string | null;
}

interface StreamChunk {
  choices?: StreamChoice[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

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
          // Streaming bypasses DashScope's ~60-90s non-stream gateway timeout:
          // as long as tokens keep flowing, the connection stays alive.
          stream: true,
          stream_options: { include_usage: true },
          ...(request.jsonMode ? { response_format: { type: "json_object" } } : {}),
          messages: [
            { role: "system", content: request.system },
            { role: "user", content: userContent },
          ],
        }),
        signal: AbortSignal.timeout(config.llm.timeoutMs),
      });
    } catch (err) {
      const timedOut = err instanceof DOMException && err.name === "TimeoutError";
      log.error(timedOut ? "llm.timeout" : "llm.network_error", {
        model: this.model,
        durationMs: Date.now() - started,
        timeoutMs: config.llm.timeoutMs,
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

    if (!response.body) {
      throw new Error(`LLM streaming response has no body (model=${this.model})`);
    }

    let text = "";
    let finishReason: string | null = null;
    let inputTokens = 0;
    let outputTokens = 0;

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE events are newline-delimited. Parse every complete line out of
        // the buffer; leave any trailing partial line for the next chunk.
        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
          const rawLine = buffer.slice(0, newlineIdx).replace(/\r$/, "");
          buffer = buffer.slice(newlineIdx + 1);
          if (!rawLine.startsWith("data:")) continue;

          const payload = rawLine.slice(5).trim();
          if (payload === "" || payload === "[DONE]") continue;

          let chunk: StreamChunk;
          try {
            chunk = JSON.parse(payload);
          } catch {
            continue;
          }

          const choice = chunk.choices?.[0];
          if (choice?.delta?.content) text += choice.delta.content;
          if (choice?.finish_reason) finishReason = choice.finish_reason;
          if (chunk.usage) {
            inputTokens = chunk.usage.prompt_tokens ?? inputTokens;
            outputTokens = chunk.usage.completion_tokens ?? outputTokens;
          }
        }
      }
    } finally {
      try {
        reader.releaseLock();
      } catch {
        // already released
      }
    }

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
      finishReason,
      streamed: true,
    });

    if (finishReason === "length") {
      throw new LLMTruncatedError("openai_compatible", this.model, outputTokens, text);
    }

    return {
      text,
      model: this.model,
      usage: {
        inputTokens,
        outputTokens,
      },
    };
  }
}
