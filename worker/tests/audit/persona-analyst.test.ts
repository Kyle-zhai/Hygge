import { describe, expect, it } from "vitest";
import { __test__ } from "../../src/audit/persona-analyst.js";

const { sanitizeFindings, sanitizeCitations, buildSearchQuery } = __test__;

describe("sanitizeCitations", () => {
  it("returns [] when raw is not an array", () => {
    expect(sanitizeCitations(null)).toEqual([]);
    expect(sanitizeCitations({})).toEqual([]);
  });

  it("drops citations without an http(s) url", () => {
    const out = sanitizeCitations([
      { url: "javascript:alert(1)", title: "x", quote: "y" },
      { url: "no-scheme", title: "x", quote: "y" },
      { url: "https://nist.gov/x", title: "ok", quote: "yes" },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].url).toBe("https://nist.gov/x");
  });

  it("caps to 8 citations", () => {
    const raw = Array.from({ length: 20 }, (_, i) => ({
      url: `https://x.gov/${i}`,
      title: `t${i}`,
      quote: "q",
    }));
    expect(sanitizeCitations(raw)).toHaveLength(8);
  });

  it("preserves published_at when string, otherwise null", () => {
    const out = sanitizeCitations([
      { url: "https://x.gov/1", title: "a", quote: "q", published_at: "2025-01-01" },
      { url: "https://x.gov/2", title: "b", quote: "q", published_at: 12345 },
      { url: "https://x.gov/3", title: "c", quote: "q" },
    ]);
    expect(out[0].published_at).toBe("2025-01-01");
    expect(out[1].published_at).toBeNull();
    expect(out[2].published_at).toBeNull();
  });
});

describe("sanitizeFindings", () => {
  it("normalizes invalid confidence to 'speculative'", () => {
    const out = sanitizeFindings([
      {
        claim: "x",
        confidence: "very-sure",
        basis: "statute",
        citations: [],
      },
    ]);
    expect(out[0].confidence).toBe("speculative");
  });

  it("normalizes invalid basis to 'secondary_source'", () => {
    const out = sanitizeFindings([
      {
        claim: "x",
        confidence: "settled",
        basis: "vibes",
        citations: [],
      },
    ]);
    expect(out[0].basis).toBe("secondary_source");
  });

  it("clamps severity and probability to [1,5]", () => {
    const out = sanitizeFindings([
      {
        claim: "x",
        confidence: "settled",
        basis: "statute",
        citations: [],
        severity: 99,
        probability: -3,
      },
    ]);
    expect(out[0].severity).toBe(5);
    expect(out[0].probability).toBe(1);
  });

  it("sets severity/probability null when not numeric", () => {
    const out = sanitizeFindings([
      {
        claim: "x",
        confidence: "settled",
        basis: "statute",
        citations: [],
        severity: "high",
        probability: NaN,
      },
    ]);
    expect(out[0].severity).toBeNull();
    expect(out[0].probability).toBeNull();
  });

  it("drops findings with empty claim", () => {
    const out = sanitizeFindings([{ claim: "  ", confidence: "settled" }]);
    expect(out).toEqual([]);
  });

  it("caps to 6 findings", () => {
    const raw = Array.from({ length: 20 }, (_, i) => ({
      claim: `claim ${i}`,
      confidence: "settled",
      basis: "statute",
      citations: [],
    }));
    expect(sanitizeFindings(raw)).toHaveLength(6);
  });
});

describe("buildSearchQuery", () => {
  const baseInput = {
    task: {
      id: "t1",
      question: "Does the system meet GOVERN-1.1 oversight?",
      law_id: "law_nist_ai_rmf",
      law_section: "GOVERN-1.1",
      target_personas: ["p1"],
      needs_challenge: false,
      rationale: "",
    },
    law: {
      id: "law_nist_ai_rmf",
      name_en: "NIST AI RMF 1.0",
      citation_format: "GOVERN-#.#",
      source_domains: ["nist.gov"],
    },
    persona: {
      id: "p1",
      display_name_en: "Compliance Partner",
      search_style: "citation-heavy",
      system_prompt: "...",
    },
    decisionText: "x",
    replyLanguage: "en" as const,
  };

  it("includes law name (quoted), section, and question excerpt", () => {
    const q = buildSearchQuery(baseInput);
    expect(q).toContain('"NIST AI RMF 1.0"');
    expect(q).toContain("GOVERN-1.1");
    expect(q).toContain("oversight");
  });

  it("appends 'guidance' flavor for citation-heavy search style", () => {
    const q = buildSearchQuery(baseInput);
    expect(q).toContain("guidance");
  });

  it("appends 'enforcement' flavor for enforcement-style personas", () => {
    const q = buildSearchQuery({
      ...baseInput,
      persona: { ...baseInput.persona, search_style: "enforcement actions" },
    });
    expect(q).toContain("enforcement");
  });

  it("does not append a flavor token when style is unrecognized", () => {
    const q = buildSearchQuery({
      ...baseInput,
      persona: { ...baseInput.persona, search_style: "vibes-only" },
    });
    // No known flavor matches → query has 3 parts (law, section, question).
    expect(q.split(" ").some((w) => w === "guidance" || w === "enforcement")).toBe(
      false,
    );
  });
});
