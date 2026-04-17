import type { LLMAdapter, LLMRequest, LLMResponse } from "./adapter.js";
import { log } from "../utils/logger.js";

const DEFAULT_GOOGLE_URL = "https://generativelanguage.googleapis.com";

async function fetchAsInlineData(
  url: string,
): Promise<{ mimeType: string; data: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const mimeType =
      res.headers.get("content-type")?.split(";")[0]?.trim() || "application/octet-stream";
    const buf = Buffer.from(await res.arrayBuffer());
    return { mimeType, data: buf.toString("base64") };
  } catch {
    return null;
  }
}

export class GoogleLLM implements LLMAdapter {
  constructor(
    private apiKey: string,
    private model: string,
    private baseURL?: string,
  ) {}

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const started = Date.now();
    const promptChars = (request.system?.length ?? 0) + (request.prompt?.length ?? 0);
    const url = `${this.baseURL || DEFAULT_GOOGLE_URL}/v1beta/models/${encodeURIComponent(
      this.model,
    )}:generateContent?key=${this.apiKey}`;

    const parts: unknown[] = [];
    if (request.media?.length) {
      for (const item of request.media) {
        const inline = await fetchAsInlineData(item.url);
        if (inline) {
          parts.push({ inlineData: inline });
        }
      }
    }
    parts.push({ text: request.prompt });

    const body: Record<string, unknown> = {
      contents: [{ role: "user", parts }],
      systemInstruction: { parts: [{ text: request.system }] },
      generationConfig: {
        maxOutputTokens: request.maxTokens ?? 4096,
        ...(request.jsonMode ? { responseMimeType: "application/json" } : {}),
      },
    };

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (err) {
      log.error("llm.network_error", {
        provider: "google",
        model: this.model,
        durationMs: Date.now() - started,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }

    if (!response.ok) {
      const errText = await response.text();
      log.error("llm.http_error", {
        provider: "google",
        model: this.model,
        status: response.status,
        durationMs: Date.now() - started,
        promptChars,
        errorBody: errText.slice(0, 500),
      });
      throw new Error(`Google API error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    let text = "";
    for (const c of data.candidates ?? []) {
      for (const p of c?.content?.parts ?? []) {
        if (typeof p?.text === "string") text += p.text;
      }
    }

    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) text = fenceMatch[1].trim();
    text = text.replace(/[\x00-\x1F\x7F]/g, (ch: string) =>
      ch === "\n" || ch === "\r" || ch === "\t" ? " " : "",
    );

    const inputTokens = data.usageMetadata?.promptTokenCount ?? 0;
    const outputTokens = data.usageMetadata?.candidatesTokenCount ?? 0;

    log.info("llm.complete", {
      provider: "google",
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

    return { text, usage: { inputTokens, outputTokens } };
  }
}
