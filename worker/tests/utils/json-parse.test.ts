import { describe, it, expect } from "vitest";
import { robustJsonParse } from "../../src/utils/json-parse.js";

describe("robustJsonParse", () => {
  it("parses well-formed JSON", () => {
    expect(robustJsonParse('{"a":1,"b":[2,3]}')).toEqual({ a: 1, b: [2, 3] });
  });

  it("strips markdown fences", () => {
    expect(robustJsonParse('```json\n{"x":42}\n```')).toEqual({ x: 42 });
  });

  it("recovers from unterminated string at end of input (truncated)", () => {
    const truncated = '{"extracted_quotes":["one","two","unfinished';
    const parsed = robustJsonParse(truncated) as { extracted_quotes: string[] };
    expect(parsed.extracted_quotes[0]).toBe("one");
    expect(parsed.extracted_quotes[1]).toBe("two");
    expect(parsed.extracted_quotes[2]).toContain("unfinished");
  });

  it("recovers from unterminated array at end of input (truncated)", () => {
    const truncated = '{"items":[1,2,3';
    expect(robustJsonParse(truncated)).toEqual({ items: [1, 2, 3] });
  });

  it("recovers when only the outer object is unclosed", () => {
    const truncated = '{"a":1,"b":{"c":2}';
    expect(robustJsonParse(truncated)).toEqual({ a: 1, b: { c: 2 } });
  });

  it("recovers from trailing comma after truncation", () => {
    const truncated = '{"items":["a","b",';
    expect(robustJsonParse(truncated)).toEqual({ items: ["a", "b"] });
  });

  it("matches the production failure shape (quotes array cut mid-element)", () => {
    const truncated =
      '{ "extracted_quotes": ["democratizing the sublime", "calligraphic gesture", "$500-$50K entry points,';
    const parsed = robustJsonParse(truncated) as { extracted_quotes: string[] };
    expect(parsed.extracted_quotes.length).toBeGreaterThanOrEqual(2);
    expect(parsed.extracted_quotes[0]).toBe("democratizing the sublime");
  });

  it("recovers from smart/curly quotes used as JSON delimiters", () => {
    // U+201C/U+201D used in place of ASCII " — common LLM output bug.
    // Note: normalization also converts curly apostrophes inside string
    // content (O’Brien → O'Brien). That's acceptable here because
    // smart-quote normalization only runs when the original input failed
    // to parse; if the JSON was valid with curly content, the first
    // attempt would have succeeded without normalization.
    const smart = '{“name”: “Margaret O’Brien”, “score”: 7}';
    expect(robustJsonParse(smart)).toEqual({ name: "Margaret O'Brien", score: 7 });
  });

  it("recovers from trailing commas before } or ]", () => {
    const trailing = '{"items": [1, 2, 3,], "name": "X",}';
    expect(robustJsonParse(trailing)).toEqual({ items: [1, 2, 3], name: "X" });
  });

  it("error preview points to the failure position with ±100 char context", () => {
    // Construct a long-ish payload where a single-quoted key is buried deep
    const padding = "x".repeat(500);
    const broken = `{"a":"${padding}", 'broken_key':1}`;
    try {
      robustJsonParse(broken);
      throw new Error("should have thrown");
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).toContain("No valid JSON found");
      expect(msg).toContain("<<<HERE>>>");
      // Preview should show the error region, not start of input
      expect(msg).toContain("chars ");
    }
  });
});
