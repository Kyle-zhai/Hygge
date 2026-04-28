import { describe, expect, it } from "vitest";
import { rankReflectionLines } from "../../src/processors/reflection-ranker.js";

const NAMES = ["Alice", "Bob", "Carol"];

describe("rankReflectionLines", () => {
  it("returns empty array for empty input", () => {
    expect(rankReflectionLines([])).toEqual([]);
  });

  it("strips whitespace-only lines", () => {
    expect(rankReflectionLines(["", "  ", "@A real"])).toEqual(["@A real"]);
  });

  it("dedupes exact duplicates", () => {
    const out = rankReflectionLines(["@A x", "@A x", "@B y"]);
    expect(out).toEqual(["@A x", "@B y"]);
  });

  it("places per-persona @-lines before global lines", () => {
    const out = rankReflectionLines([
      "global note one",
      "@Alice — you redirected",
      "global note two",
      "@Bob — your point about X",
    ]);
    expect(out[0]).toBe("@Alice — you redirected");
    expect(out[1]).toBe("@Bob — your point about X");
    expect(out.slice(2)).toEqual(["global note one", "global note two"]);
  });

  it("treats lines mentioning persona names as named (no @ required)", () => {
    const out = rankReflectionLines(
      [
        "global one",
        "META-REFLECTION: Alice, Bob have not moved their position",
        "global two",
        "UN-RESPONDED CLAIM (round 1, Carol): \"do the LTV math\"",
      ],
      NAMES,
    );
    expect(out[0]).toContain("Alice, Bob");
    expect(out[1]).toContain("Carol");
    expect(out.slice(2)).toEqual(["global one", "global two"]);
  });

  it("only checks the first ~120 chars for persona name matches", () => {
    const longGlobal = "META-REFLECTION: " + "x".repeat(200) + " Alice";
    const out = rankReflectionLines([longGlobal, "@A real"], NAMES);
    expect(out[0]).toBe("@A real");
  });

  it("caps global lines at MAX_GLOBAL_LINES", () => {
    const out = rankReflectionLines(
      ["global one", "global two", "global three", "global four"],
      NAMES,
    );
    expect(out).toEqual(["global one", "global two"]);
  });

  it("keeps all named lines even when above the global cap", () => {
    const lines = [
      "@A1 one", "@A2 two", "@A3 three", "@A4 four", "@A5 five",
      "global one", "global two", "global three",
    ];
    const out = rankReflectionLines(lines, NAMES);
    expect(out.filter((l) => l.startsWith("@"))).toHaveLength(5);
    expect(out.filter((l) => !l.startsWith("@"))).toHaveLength(1);
    expect(out).toHaveLength(6);
  });

  it("caps total at maxLines", () => {
    const lines = ["@A1", "@A2", "@A3", "@A4", "@A5", "@A6", "@A7", "@A8"];
    const out = rankReflectionLines(lines, NAMES, { maxLines: 3 });
    expect(out).toHaveLength(3);
  });

  it("preserves input order within each bucket", () => {
    const out = rankReflectionLines(
      [
        "@B second-named",
        "global first",
        "@A first-named",
        "global second",
      ],
      NAMES,
    );
    expect(out).toEqual([
      "@B second-named",
      "@A first-named",
      "global first",
      "global second",
    ]);
  });

  it("respects custom maxGlobalLines", () => {
    const out = rankReflectionLines(
      ["g1", "g2", "g3", "g4"],
      NAMES,
      { maxGlobalLines: 1 },
    );
    expect(out).toEqual(["g1"]);
  });

  it("works with empty personaNames (only @-prefix counts as named)", () => {
    const out = rankReflectionLines([
      "META-REFLECTION: Alice has not moved",
      "@Bob redirect",
    ]);
    expect(out[0]).toBe("@Bob redirect");
    expect(out[1]).toBe("META-REFLECTION: Alice has not moved");
  });
});
