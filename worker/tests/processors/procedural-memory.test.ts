import { describe, expect, it } from "vitest";
import { formatProceduralExamples, type ProceduralExample } from "../../src/processors/procedural-memory.js";

describe("formatProceduralExamples", () => {
  it("returns empty string when there are no examples", () => {
    expect(formatProceduralExamples([])).toBe("");
  });

  it("includes both utterance and user comment when both are available", () => {
    const examples: ProceduralExample[] = [
      {
        persona_id: "p1",
        utterance_excerpt: "Their churn cohort is the real signal here.",
        user_comment: "this sounded like a real VC",
        created_at: "2026-04-01T00:00:00Z",
      },
    ];
    const out = formatProceduralExamples(examples);
    expect(out).toContain("Their churn cohort is the real signal here.");
    expect(out).toContain("this sounded like a real VC");
    expect(out).toContain("Procedural memory");
  });

  it("falls back to comment-only when utterance is missing", () => {
    const examples: ProceduralExample[] = [
      {
        persona_id: "p1",
        utterance_excerpt: null,
        user_comment: "loved that this persona pushed back",
        created_at: "2026-04-01T00:00:00Z",
      },
    ];
    const out = formatProceduralExamples(examples);
    expect(out).toContain("Earlier feedback you earned");
    expect(out).toContain("loved that this persona pushed back");
  });

  it("falls back to utterance-only when comment is missing", () => {
    const examples: ProceduralExample[] = [
      {
        persona_id: "p1",
        utterance_excerpt: "I'd want a real LTV before I sign.",
        user_comment: null,
        created_at: "2026-04-01T00:00:00Z",
      },
    ];
    const out = formatProceduralExamples(examples);
    expect(out).toContain("flagged as authentic");
    expect(out).toContain("I'd want a real LTV before I sign.");
  });

  it("numbers multiple examples sequentially", () => {
    const examples: ProceduralExample[] = [
      { persona_id: "p1", utterance_excerpt: "first", user_comment: "good", created_at: "2026-04-01T00:00:00Z" },
      { persona_id: "p1", utterance_excerpt: "second", user_comment: "great", created_at: "2026-04-02T00:00:00Z" },
    ];
    const out = formatProceduralExamples(examples);
    expect(out).toContain("(1) You said: \"first\"");
    expect(out).toContain("(2) You said: \"second\"");
  });

  it("instructs the model to channel rather than quote the examples", () => {
    const examples: ProceduralExample[] = [
      { persona_id: "p1", utterance_excerpt: "x", user_comment: "y", created_at: "2026-04-01T00:00:00Z" },
    ];
    const out = formatProceduralExamples(examples);
    expect(out).toContain("Do NOT quote them");
  });
});
