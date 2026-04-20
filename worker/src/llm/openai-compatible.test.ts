import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpenAICompatibleLLM } from "./openai-compatible.js";

interface StreamChunk {
  choices?: Array<{ delta?: { content?: string }; finish_reason?: string | null }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

// Build an SSE Response that streams the given chunks plus a [DONE] terminator.
function sseResponse(chunks: StreamChunk[], status = 200): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
  return new Response(stream, {
    status,
    headers: { "Content-Type": "text/event-stream" },
  });
}

// Streams `content` split roughly in half to exercise multi-chunk buffering,
// then sends a finish_reason chunk and an optional usage chunk.
function textStream(
  content: string,
  opts: {
    finish_reason?: string;
    usage?: { prompt_tokens: number; completion_tokens: number };
  } = {},
): StreamChunk[] {
  const chunks: StreamChunk[] = [];
  if (content.length > 0) {
    const mid = Math.max(1, Math.floor(content.length / 2));
    chunks.push({ choices: [{ delta: { content: content.slice(0, mid) } }] });
    chunks.push({ choices: [{ delta: { content: content.slice(mid) } }] });
  }
  chunks.push({ choices: [{ delta: {}, finish_reason: opts.finish_reason ?? "stop" }] });
  if (opts.usage) chunks.push({ usage: opts.usage });
  return chunks;
}

function mockFetchStream(
  content: string,
  opts?: {
    finish_reason?: string;
    usage?: { prompt_tokens: number; completion_tokens: number };
  },
): void {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(sseResponse(textStream(content, opts))));
}

describe("OpenAICompatibleLLM", () => {
  let llm: OpenAICompatibleLLM;

  beforeEach(() => {
    llm = new OpenAICompatibleLLM("test-key", "qwen3.6-plus", "https://example.com/v1");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("strips ```json fences from the response", async () => {
    mockFetchStream('```json\n{"ok": true}\n```', {
      usage: { prompt_tokens: 10, completion_tokens: 20 },
    });
    const { text } = await llm.complete({ system: "s", prompt: "p" });
    expect(text).toBe('{"ok": true}');
  });

  it("strips bare ``` fences", async () => {
    mockFetchStream("```\n{\"value\": 1}\n```", {
      usage: { prompt_tokens: 10, completion_tokens: 20 },
    });
    const { text } = await llm.complete({ system: "s", prompt: "p" });
    expect(text).toBe('{"value": 1}');
  });

  it("preserves content without fences", async () => {
    mockFetchStream('{"value": 42}', { usage: { prompt_tokens: 10, completion_tokens: 20 } });
    const { text } = await llm.complete({ system: "s", prompt: "p" });
    expect(text).toBe('{"value": 42}');
  });

  it("replaces newline/tab control chars with spaces (keeps JSON parseable)", async () => {
    mockFetchStream('{"a":\n"line\tbreak"}', {
      usage: { prompt_tokens: 10, completion_tokens: 20 },
    });
    const { text } = await llm.complete({ system: "s", prompt: "p" });
    expect(text).toBe('{"a": "line break"}');
    expect(() => JSON.parse(text)).not.toThrow();
  });

  it("strips other control chars entirely", async () => {
    mockFetchStream('{"a":"\x01\x02hello\x07"}', {
      usage: { prompt_tokens: 10, completion_tokens: 20 },
    });
    const { text } = await llm.complete({ system: "s", prompt: "p" });
    expect(text).toBe('{"a":"hello"}');
  });

  it("returns usage tokens when provided", async () => {
    mockFetchStream("ok", { usage: { prompt_tokens: 100, completion_tokens: 50 } });
    const { usage } = await llm.complete({ system: "s", prompt: "p" });
    expect(usage).toEqual({ inputTokens: 100, outputTokens: 50 });
  });

  it("defaults usage to zero when missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(sseResponse(textStream("ok"))),
    );
    const { usage } = await llm.complete({ system: "s", prompt: "p" });
    expect(usage).toEqual({ inputTokens: 0, outputTokens: 0 });
  });

  it("throws on non-ok HTTP status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("rate limited", { status: 429 })),
    );
    await expect(llm.complete({ system: "s", prompt: "p" })).rejects.toThrow(/429/);
  });

  it("rethrows on network errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNRESET")));
    await expect(llm.complete({ system: "s", prompt: "p" })).rejects.toThrow("ECONNRESET");
  });

  it("sets response_format when jsonMode is true", async () => {
    const fetchMock = vi.fn().mockResolvedValue(sseResponse(textStream("ok")));
    vi.stubGlobal("fetch", fetchMock);
    await llm.complete({ system: "s", prompt: "p", jsonMode: true });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.response_format).toEqual({ type: "json_object" });
  });

  it("omits response_format when jsonMode is absent", async () => {
    const fetchMock = vi.fn().mockResolvedValue(sseResponse(textStream("ok")));
    vi.stubGlobal("fetch", fetchMock);
    await llm.complete({ system: "s", prompt: "p" });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.response_format).toBeUndefined();
  });

  it("sends stream=true and stream_options.include_usage=true", async () => {
    const fetchMock = vi.fn().mockResolvedValue(sseResponse(textStream("ok")));
    vi.stubGlobal("fetch", fetchMock);
    await llm.complete({ system: "s", prompt: "p" });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.stream).toBe(true);
    expect(body.stream_options).toEqual({ include_usage: true });
  });

  it("sends multimodal content when media is provided", async () => {
    const fetchMock = vi.fn().mockResolvedValue(sseResponse(textStream("ok")));
    vi.stubGlobal("fetch", fetchMock);
    await llm.complete({
      system: "s",
      prompt: "describe this",
      media: [{ type: "image", url: "data:image/png;base64,AAA" }],
    });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const userMessage = body.messages.find((m: { role: string }) => m.role === "user");
    expect(Array.isArray(userMessage.content)).toBe(true);
    expect(userMessage.content[0]).toEqual({
      type: "image_url",
      image_url: { url: "data:image/png;base64,AAA" },
    });
    expect(userMessage.content.at(-1)).toEqual({ type: "text", text: "describe this" });
  });

  it("uses plain string content when no media is provided", async () => {
    const fetchMock = vi.fn().mockResolvedValue(sseResponse(textStream("ok")));
    vi.stubGlobal("fetch", fetchMock);
    await llm.complete({ system: "s", prompt: "hello" });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const userMessage = body.messages.find((m: { role: string }) => m.role === "user");
    expect(userMessage.content).toBe("hello");
  });

  it("concatenates multi-chunk deltas correctly across arbitrary splits", async () => {
    // Simulate a provider that fragments tokens across many tiny SSE events.
    const chunks: StreamChunk[] = [
      { choices: [{ delta: { content: "Hel" } }] },
      { choices: [{ delta: { content: "lo" } }] },
      { choices: [{ delta: { content: ", " } }] },
      { choices: [{ delta: { content: "world" } }] },
      { choices: [{ delta: {}, finish_reason: "stop" }] },
    ];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(sseResponse(chunks)));
    const { text } = await llm.complete({ system: "s", prompt: "p" });
    expect(text).toBe("Hello, world");
  });

  it("throws LLMTruncatedError when finish_reason='length'", async () => {
    mockFetchStream("partial output", {
      finish_reason: "length",
      usage: { prompt_tokens: 10, completion_tokens: 4096 },
    });
    await expect(llm.complete({ system: "s", prompt: "p" })).rejects.toThrow(/truncated/i);
  });

  it("tolerates malformed data chunks without failing the stream", async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"ok"}}]}\n\n'));
        controller.enqueue(encoder.encode("data: {not-valid-json\n\n"));
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n'));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(stream, { status: 200, headers: { "Content-Type": "text/event-stream" } }),
      ),
    );
    const { text } = await llm.complete({ system: "s", prompt: "p" });
    expect(text).toBe("ok");
  });
});
