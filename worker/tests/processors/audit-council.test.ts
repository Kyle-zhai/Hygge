import { describe, expect, it } from "vitest";
import { clampScore, normalizeFinding } from "../../src/processors/audit-council.js";

describe("clampScore", () => {
  it("returns null for non-numbers", () => {
    expect(clampScore(undefined)).toBeNull();
    expect(clampScore(null)).toBeNull();
    expect(clampScore("3")).toBeNull();
    expect(clampScore(NaN)).toBeNull();
    expect(clampScore(Infinity)).toBeNull();
  });

  it("clamps below 1 up to 1, above 5 down to 5", () => {
    expect(clampScore(0)).toBe(1);
    expect(clampScore(-3)).toBe(1);
    expect(clampScore(7)).toBe(5);
    expect(clampScore(99)).toBe(5);
  });

  it("rounds floats", () => {
    expect(clampScore(2.6)).toBe(3);
    expect(clampScore(2.4)).toBe(2);
  });

  it("passes valid integers through", () => {
    for (let i = 1; i <= 5; i++) expect(clampScore(i)).toBe(i);
  });
});

describe("normalizeFinding", () => {
  const base = { persona_id: "p1" };

  it("forces null severity/probability for mitigation kinds", () => {
    const out = normalizeFinding(
      { ...base, finding_kind: "mitigation", claim: "add a kill switch", severity: 4, probability: 4 },
      "s1",
      0,
    );
    expect(out.finding_kind).toBe("mitigation");
    expect(out.severity).toBeNull();
    expect(out.probability).toBeNull();
  });

  it("forces null severity/probability for no_risk kinds", () => {
    const out = normalizeFinding(
      { ...base, finding_kind: "no_risk", claim: "no impact on user data", severity: 5 },
      "s1",
      0,
    );
    expect(out.severity).toBeNull();
    expect(out.probability).toBeNull();
  });

  it("preserves valid severity/probability for risk kinds", () => {
    const out = normalizeFinding(
      { ...base, finding_kind: "risk", claim: "data leak", severity: 4, probability: 3 },
      "s1",
      0,
    );
    expect(out.severity).toBe(4);
    expect(out.probability).toBe(3);
  });

  it("falls back to 'risk' for unknown finding_kind", () => {
    const out = normalizeFinding(
      { ...base, finding_kind: "speculation", claim: "x" },
      "s1",
      0,
    );
    expect(out.finding_kind).toBe("risk");
  });

  it("substitutes (no claim) for empty claim", () => {
    const out = normalizeFinding({ ...base, finding_kind: "risk", claim: "" }, "s1", 0);
    expect(out.claim).toBe("(no claim)");
  });

  it("packs evidence + stakeholders + regulation_refs into evidence_refs jsonb", () => {
    const out = normalizeFinding(
      {
        ...base,
        finding_kind: "risk",
        claim: "discrimination risk",
        severity: 4,
        probability: 3,
        evidence: "auto-respond to L1 issues without human review",
        affected_stakeholders: ["customers", "support team"],
        regulation_refs: ["EU AI Act Art. 14"],
      },
      "s1",
      2,
    );
    expect(out.evidence_refs).toHaveLength(3);
    expect(out.evidence_refs[0]).toMatchObject({ kind: "phrase" });
    expect(out.evidence_refs[1]).toMatchObject({ kind: "affected_stakeholders" });
    expect(out.evidence_refs[2]).toMatchObject({ kind: "regulation_refs" });
  });

  it("returns empty evidence_refs when no auxiliary data is provided", () => {
    const out = normalizeFinding(
      { ...base, finding_kind: "risk", claim: "x", severity: 1, probability: 1 },
      "s1",
      0,
    );
    expect(out.evidence_refs).toEqual([]);
  });

  it("clamps oversized claim text to 2000 chars", () => {
    const longClaim = "a".repeat(5000);
    const out = normalizeFinding(
      { ...base, finding_kind: "risk", claim: longClaim },
      "s1",
      0,
    );
    expect(out.claim.length).toBe(2000);
  });
});
