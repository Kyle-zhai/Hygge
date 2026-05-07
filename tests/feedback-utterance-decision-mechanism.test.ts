// Coverage for the decision_mechanism address kind added to the feedback
// flywheel as part of the 2026-05-06 reverse pivot. Same shape rigor as
// the round_table / one_v_one tests; ensures the schema validates the new
// shape before anything reaches the DB.

import { describe, it, expect } from "vitest";
import {
  PostBodySchema,
  DeleteBodySchema,
  GetQuerySchema,
} from "@/app/api/feedback/utterance/schema";

const RUN_ID = "33333333-3333-3333-3333-333333333333";
const BRIEF_ID = "44444444-4444-4444-4444-444444444444";

describe("feedback utterance — decision_mechanism kind", () => {
  it("accepts a valid POST body", () => {
    const result = PostBodySchema.safeParse({
      kind: "decision_mechanism",
      mechanismRunId: RUN_ID,
      utteranceIndex: 4,
      personaId: "p_chen",
      rating: 1,
      comment: "Sharp insight",
    });
    expect(result.success).toBe(true);
  });

  it("rejects negative utterance index", () => {
    const result = PostBodySchema.safeParse({
      kind: "decision_mechanism",
      mechanismRunId: RUN_ID,
      utteranceIndex: -1,
      personaId: "p_chen",
      rating: 1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects oversized comment", () => {
    const result = PostBodySchema.safeParse({
      kind: "decision_mechanism",
      mechanismRunId: RUN_ID,
      utteranceIndex: 0,
      personaId: "p_chen",
      rating: 1,
      comment: "x".repeat(281),
    });
    expect(result.success).toBe(false);
  });

  it("DELETE body validates address fields", () => {
    const result = DeleteBodySchema.safeParse({
      kind: "decision_mechanism",
      mechanismRunId: RUN_ID,
      utteranceIndex: 0,
    });
    expect(result.success).toBe(true);
  });

  it("GET query accepts decisionBriefId only", () => {
    const ok = GetQuerySchema.safeParse({ decisionBriefId: BRIEF_ID });
    expect(ok.success).toBe(true);
  });

  it("GET query rejects multiple ids at once", () => {
    const result = GetQuerySchema.safeParse({
      evaluationId: BRIEF_ID,
      decisionBriefId: BRIEF_ID,
    });
    expect(result.success).toBe(false);
  });

  it("GET query rejects no ids at all", () => {
    const result = GetQuerySchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
