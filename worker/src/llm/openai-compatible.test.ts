import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpenAICompatibleLLM } from "./openai-compatible.js";

function mockFetchJson(body: unknown, init: Partial<Response> = {}): void {
  const res = new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "Content-Type": "application/json" },
  });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(res));
}

function choice(content: string, usage = { prompt_tokens: 10, completion_tokens: 20 }) {
  return { choices: [{ message: { content } }], usage };
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
    mockFetchJson(choice('```json\n{"ok": true}\n```'));
    const { text } = await llm.complete({ system: "s", prompt: "p" });
    expect(text).toBe('{"ok": true}');
  });

  it("strips bare ``` fences", async () => {
    mockFetchJson(choice("```\n{\"value\": 1}\n```"));
    const { text } = await llm.complete({ system: "s", prompt: "p" });
    expect(text).toBe('{"value": 1}');
  });

  it("preserves content without fences", async () => {
    mockFetchJson(choice('{"value": 42}'));
    const { text } = await llm.complete({ system: "s", prompt: "p" });
    expect(text).toBe('{"value": 42}');
  });

  it("replaces newline/tab control chars with spaces (keeps JSON parseable)", async () => {
    mockFetchJson(choice('{"a":\n"line\tbreak"}'));
    const { text } = await llm.complete({ system: "s", prompt: "p" });
    expect(text).toBe('{"a": "line break"}');
    expect(() => JSON.parse(text)).not.toThrow();
  });

  it("strips other control chars entirely", async () => {
    mockFetchJson(choice('{"a":"\x01\x02hello\x07"}'));
    const { text } = await llm.complete({ system: "s", prompt: "p" });
    expect(text).toBe('{"a":"hello"}');
  });

  it("returns usage tokens when provided", async () => {
    mockFetchJson(choice("ok", { prompt_tokens: 100, completion_tokens: 50 }));
    const { usage } = await llm.complete({ system: "s", prompt: "p" });
    expect(usage).toEqual({ inputTokens: 100, outputTokens: 50 });
  });

  it("defaults usage to zero when missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), { status: 200 }),
      ),
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
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(choice("ok")), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await llm.complete({ system: "s", prompt: "p", jsonMode: true });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.response_format).toEqual({ type: "json_object" });
  });

  it("omits response_format when jsonMode is absent", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(choice("ok")), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await llm.complete({ system: "s", prompt: "p" });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.response_format).toBeUndefined();
  });

  it("sends multimodal content when media is provided", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(choice("ok")), { status: 200 }),
    );
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
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(choice("ok")), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await llm.complete({ system: "s", prompt: "hello" });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const userMessage = body.messages.find((m: { role: string }) => m.role === "user");
    expect(userMessage.content).toBe("hello");
  });
});
