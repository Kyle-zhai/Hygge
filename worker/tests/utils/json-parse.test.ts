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
});
