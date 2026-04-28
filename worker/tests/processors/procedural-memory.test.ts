import { describe, expect, it } from "vitest";
import {
  formatProceduralExamples,
  type ContrastiveProceduralMemory,
  type ProceduralExample,
} from "../../src/processors/procedural-memory.js";

function ex(overrides: Partial<ProceduralExample> & { persona_id: string }): ProceduralExample {
  return {
    utterance_excerpt: null,
    user_comment: null,
    created_at: "2026-04-01T00:00:00Z",
    ...overrides,
  };
}

describe("formatProceduralExamples", () => {
  it("returns empty string when both buckets are empty", () => {
    const memory: ContrastiveProceduralMemory = { positive: [], negative: [] };
    expect(formatProceduralExamples(memory)).toBe("");
  });

  it("includes both utterance and user comment when both are available (positive)", () => {
    const memory: ContrastiveProceduralMemory = {
      positive: [ex({ persona_id: "p1", utterance_excerpt: "Their churn cohort is the real signal", user_comment: "sounded like a real VC" })],
      negative: [],
    };
    const out = formatProceduralExamples(memory);
    expect(out).toContain("Their churn cohort is the real signal");
    expect(out).toContain("sounded like a real VC");
    expect(out).toContain("sound LIKE this");
  });

  it("emits a separate negative section when negatives exist", () => {
    const memory: ContrastiveProceduralMemory = {
      positive: [ex({ persona_id: "p1", utterance_excerpt: "concrete claim", user_comment: "good" })],
      negative: [ex({ persona_id: "p1", utterance_excerpt: "let us analyze from multiple angles", user_comment: "generic LLM-speak" })],
    };
    const out = formatProceduralExamples(memory);
    expect(out).toContain("sound LIKE this");
    expect(out).toContain("do NOT sound like this");
    expect(out).toContain("let us analyze from multiple angles");
    expect(out).toContain("generic LLM-speak");
  });

  it("falls back to comment-only when utterance is missing (negative)", () => {
    const memory: ContrastiveProceduralMemory = {
      positive: [],
      negative: [ex({ persona_id: "p1", user_comment: "too hedgy" })],
    };
    const out = formatProceduralExamples(memory);
    expect(out).toContain("Negative feedback you earned");
    expect(out).toContain("too hedgy");
  });

  it("falls back to utterance-only when comment is missing (positive)", () => {
    const memory: ContrastiveProceduralMemory = {
      positive: [ex({ persona_id: "p1", utterance_excerpt: "I'd want a real LTV before I sign." })],
      negative: [],
    };
    const out = formatProceduralExamples(memory);
    expect(out).toContain("flagged as authentic");
    expect(out).toContain("I'd want a real LTV before I sign.");
  });

  it("works with negatives only when no positives exist", () => {
    const memory: ContrastiveProceduralMemory = {
      positive: [],
      negative: [ex({ persona_id: "p1", utterance_excerpt: "interesting question", user_comment: "cliché" })],
    };
    const out = formatProceduralExamples(memory);
    expect(out).not.toContain("sound LIKE this");
    expect(out).toContain("do NOT sound like this");
  });

  it("numbers multiple examples sequentially within each bucket", () => {
    const memory: ContrastiveProceduralMemory = {
      positive: [
        ex({ persona_id: "p1", utterance_excerpt: "first", user_comment: "good" }),
        ex({ persona_id: "p1", utterance_excerpt: "second", user_comment: "great" }),
      ],
      negative: [
        ex({ persona_id: "p1", utterance_excerpt: "bad-one", user_comment: "stiff" }),
      ],
    };
    const out = formatProceduralExamples(memory);
    expect(out).toContain("(1) \"first\"");
    expect(out).toContain("(2) \"second\"");
    expect(out).toContain("(1) \"bad-one\"");
  });

  it("instructs the model to channel positives and avoid negatives", () => {
    const memory: ContrastiveProceduralMemory = {
      positive: [ex({ persona_id: "p1", utterance_excerpt: "x", user_comment: "y" })],
      negative: [ex({ persona_id: "p1", utterance_excerpt: "a", user_comment: "b" })],
    };
    const out = formatProceduralExamples(memory);
    expect(out).toContain("Channel the texture of the positives");
    expect(out).toContain("Avoid the texture of the negatives");
    expect(out).toContain("Do NOT quote either set");
  });
});
