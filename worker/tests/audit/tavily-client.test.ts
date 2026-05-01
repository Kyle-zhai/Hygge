import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { __test__, tavilySearch } from "../../src/audit/tavily-client.js";

const { buildQueryHash, pickEarliestPublishedAt, normalizeApiResults } = __test__;

describe("buildQueryHash", () => {
  it("is stable across domain order and case", () => {
    const a = buildQueryHash("foo", ["a.gov", "B.gov"], "basic");
    const b = buildQueryHash("foo", ["b.gov", "A.GOV"], "basic");
    expect(a).toBe(b);
  });

  it("differs when depth changes", () => {
    const a = buildQueryHash("foo", ["x.gov"], "basic");
    const b = buildQueryHash("foo", ["x.gov"], "advanced");
    expect(a).not.toBe(b);
  });

  it("ignores empty-string domains", () => {
    const a = buildQueryHash("q", ["x.gov", "", "  "], "basic");
    const b = buildQueryHash("q", ["x.gov"], "basic");
    expect(a).toBe(b);
  });
});

describe("pickEarliestPublishedAt", () => {
  it("picks the earliest valid date", () => {
    const out = pickEarliestPublishedAt([
      { url: "https://a", title: "", snippet: "", published_at: "2025-06-01" },
      { url: "https://b", title: "", snippet: "", published_at: "2024-01-15" },
      { url: "https://c", title: "", snippet: "", published_at: "2025-12-31" },
    ]);
    expect(out).toBe(new Date("2024-01-15").toISOString());
  });

  it("returns null when no result has a parseable date", () => {
    const out = pickEarliestPublishedAt([
      { url: "https://a", title: "", snippet: "", published_at: "garbage" },
      { url: "https://b", title: "", snippet: "", published_at: null },
    ]);
    expect(out).toBeNull();
  });

  it("returns null on empty list", () => {
    expect(pickEarliestPublishedAt([])).toBeNull();
  });
});

describe("normalizeApiResults", () => {
  it("returns [] for non-array input", () => {
    expect(normalizeApiResults(undefined)).toEqual([]);
  });

  it("drops items without a url", () => {
    const out = normalizeApiResults([
      { url: "  ", title: "x", content: "y" },
      { url: "https://ok.gov", title: "x", content: "y" },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].url).toBe("https://ok.gov");
  });

  it("falls back to content when snippet missing, capped to 1500", () => {
    const longContent = "x".repeat(5000);
    const out = normalizeApiResults([
      { url: "https://ok.gov", title: "t", content: longContent },
    ]);
    expect(out[0].snippet.length).toBe(1500);
  });

  it("preserves raw_content when includeRawContent fed it through, capped to 16000", () => {
    const huge = "y".repeat(20000);
    const out = normalizeApiResults([
      { url: "https://ok.gov", title: "t", content: "c", raw_content: huge },
    ]);
    expect(out[0].content?.length).toBe(16000);
  });

  it("trims long titles to 500 chars", () => {
    const out = normalizeApiResults([
      { url: "https://ok.gov", title: "z".repeat(2000), content: "c" },
    ]);
    expect(out[0].title.length).toBe(500);
  });
});

describe("tavilySearch with no API key", () => {
  const originalKey = process.env.TAVILY_API_KEY;

  beforeEach(() => {
    delete process.env.TAVILY_API_KEY;
  });

  afterEach(() => {
    if (originalKey !== undefined) process.env.TAVILY_API_KEY = originalKey;
  });

  it("returns an empty record without hitting the network or cache", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const out = await tavilySearch({
      query: "test query",
      domains: ["example.gov"],
      searchDepth: "basic",
    });
    expect(out.results).toEqual([]);
    expect(out.fromCache).toBe(false);
    expect(out.cacheId).toBe("");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
