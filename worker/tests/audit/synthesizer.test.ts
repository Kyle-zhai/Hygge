import { describe, expect, it } from "vitest";
import {
  __test__,
  STALE_DAYS,
  DISCLAIMER_EN,
  DISCLAIMER_ZH,
  computeStale,
} from "../../src/audit/synthesizer.js";
import type {
  PersonaFinding,
  FindingCitation,
} from "../../src/audit/persona-analyst.js";

const {
  sanitizeInScope,
  sanitizeOutOfScope,
  sanitizeOpenQuestions,
  pickDisclaimer,
} = __test__;

const STALE_MS = STALE_DAYS * 24 * 60 * 60 * 1000;

function makeCitation(overrides: Partial<FindingCitation> = {}): FindingCitation {
  return {
    url: "https://nist.gov/x",
    title: "x",
    quote: "q",
    published_at: null,
    ...overrides,
  };
}

describe("computeStale", () => {
  const now = Date.UTC(2026, 5, 1); // 2026-06-01

  function inputForCache(verifiedAt: string | null) {
    return {
      finding: {
        claim: "c",
        confidence: "settled" as const,
        basis: "statute" as const,
        citations: [] as FindingCitation[],
        severity: null,
        probability: null,
        suggested_mitigation: null,
        task_id: "t1",
        persona_id: "p1",
        law_id: "L",
        law_section: "S",
        searchCacheLastVerifiedAt: verifiedAt,
      },
      now,
    };
  }

  it("returns true when cache last_verified_at is older than STALE_DAYS", () => {
    const old = new Date(now - STALE_MS - 1000).toISOString();
    expect(computeStale(inputForCache(old))).toBe(true);
  });

  it("returns false when cache is recent and no citations", () => {
    const recent = new Date(now - 1000).toISOString();
    expect(computeStale(inputForCache(recent))).toBe(false);
  });

  it("returns true when all dated citations are older than STALE_DAYS", () => {
    const old = new Date(now - STALE_MS - 1000).toISOString();
    expect(
      computeStale({
        finding: {
          ...inputForCache(null).finding,
          citations: [makeCitation({ published_at: old })],
        },
        now,
      }),
    ).toBe(true);
  });

  it("returns false when at least one citation is fresh", () => {
    const old = new Date(now - STALE_MS - 1000).toISOString();
    const fresh = new Date(now - 1000).toISOString();
    expect(
      computeStale({
        finding: {
          ...inputForCache(null).finding,
          citations: [
            makeCitation({ published_at: old }),
            makeCitation({ published_at: fresh }),
          ],
        },
        now,
      }),
    ).toBe(false);
  });

  it("does not mark stale when no citation has a published_at", () => {
    expect(
      computeStale({
        finding: {
          ...inputForCache(null).finding,
          citations: [makeCitation({ published_at: null })],
        },
        now,
      }),
    ).toBe(false);
  });
});

describe("pickDisclaimer", () => {
  it("returns the EN disclaimer for en", () => {
    expect(pickDisclaimer("en")).toBe(DISCLAIMER_EN);
  });

  it("returns the ZH disclaimer for zh", () => {
    expect(pickDisclaimer("zh")).toBe(DISCLAIMER_ZH);
  });
});

describe("sanitizeOpenQuestions", () => {
  it("returns [] for non-array", () => {
    expect(sanitizeOpenQuestions(null)).toEqual([]);
    expect(sanitizeOpenQuestions("x")).toEqual([]);
  });

  it("drops non-strings and trims/truncates", () => {
    const long = "a".repeat(1000);
    const out = sanitizeOpenQuestions(["  why?  ", 123, null, long]);
    expect(out[0]).toBe("why?");
    expect(out[1].length).toBe(400);
  });

  it("caps at 8 questions", () => {
    const raw = Array.from({ length: 20 }, (_, i) => `q${i}`);
    expect(sanitizeOpenQuestions(raw)).toHaveLength(8);
  });
});

describe("sanitizeOutOfScope", () => {
  it("uses scopeOut as source of truth and falls back to scopeOut.reason when model omits it", () => {
    const out = sanitizeOutOfScope(
      [{ law_id: "law_x", reason: "model-provided reason" }],
      [
        { law_id: "law_x", reason: "scope-out reason X" },
        { law_id: "law_y", reason: "scope-out reason Y" },
      ],
    );
    expect(out).toHaveLength(2);
    const x = out.find((o) => o.law_id === "law_x")!;
    const y = out.find((o) => o.law_id === "law_y")!;
    expect(x.reason).toBe("model-provided reason");
    expect(y.reason).toBe("scope-out reason Y");
  });

  it("ignores model rows that don't appear in scopeOut", () => {
    const out = sanitizeOutOfScope(
      [{ law_id: "ghost_law", reason: "fake" }],
      [{ law_id: "law_x", reason: "scope-out X" }],
    );
    expect(out).toEqual([{ law_id: "law_x", reason: "scope-out X" }]);
  });
});

describe("sanitizeInScope", () => {
  const validLawIds = new Set(["law_a", "law_b"]);
  const staleByKey = new Map<string, boolean>();

  it("drops in_scope rows with invented law_ids", () => {
    const out = sanitizeInScope(
      [{ law_id: "ghost", overall_compliance: "compliant", findings: [] }],
      validLawIds,
      staleByKey,
    );
    expect(out).toEqual([]);
  });

  it("dedupes the same law_id appearing twice", () => {
    const out = sanitizeInScope(
      [
        { law_id: "law_a", overall_compliance: "compliant", findings: [] },
        { law_id: "law_a", overall_compliance: "non_compliant", findings: [] },
      ],
      validLawIds,
      staleByKey,
    );
    expect(out).toHaveLength(1);
    expect(out[0].overall_compliance).toBe("compliant");
  });

  it("normalizes invalid overall_compliance to 'unknown'", () => {
    const out = sanitizeInScope(
      [{ law_id: "law_a", overall_compliance: "kinda-fine", findings: [] }],
      validLawIds,
      staleByKey,
    );
    expect(out[0].overall_compliance).toBe("unknown");
  });

  it("validates each finding and keeps only valid confidence/basis enums", () => {
    const out = sanitizeInScope(
      [
        {
          law_id: "law_a",
          overall_compliance: "partial",
          findings: [
            {
              section: "GOVERN-1.1",
              claim: "AI bias monitoring is inadequate.",
              confidence: "very-sure",
              basis: "vibes",
              stale: false,
              citations: [],
              dissent: null,
              severity: 3,
              probability: 4,
              suggested_mitigation: null,
            },
          ],
        },
      ],
      validLawIds,
      staleByKey,
    );
    expect(out[0].findings[0].confidence).toBe("speculative");
    expect(out[0].findings[0].basis).toBe("secondary_source");
  });

  it("caps findings per law to 12", () => {
    const findings = Array.from({ length: 20 }, (_, i) => ({
      section: `S${i}`,
      claim: `claim ${i}`,
      confidence: "settled",
      basis: "statute",
      stale: false,
      citations: [],
      dissent: null,
      severity: 3,
      probability: 3,
      suggested_mitigation: null,
    }));
    const out = sanitizeInScope(
      [{ law_id: "law_a", overall_compliance: "partial", findings }],
      validLawIds,
      staleByKey,
    );
    expect(out[0].findings).toHaveLength(12);
  });
});
