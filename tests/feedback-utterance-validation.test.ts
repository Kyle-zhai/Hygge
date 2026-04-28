import { describe, it, expect } from "vitest";
import { PostBodySchema, DeleteBodySchema, GetQuerySchema } from "@/app/api/feedback/utterance/schema";

describe("feedback utterance schemas", () => {
  it("accepts a valid round-table POST body", () => {
    const result = PostBodySchema.safeParse({
      kind: "round_table",
      evaluationId: "11111111-1111-1111-1111-111111111111",
      roundNumber: 2,
      messageIndex: 0,
      personaId: "p_alice",
      rating: -1,
      comment: "doesn't sound like her",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid 1v1 POST body", () => {
    const result = PostBodySchema.safeParse({
      kind: "one_v_one",
      debateMessageId: "22222222-2222-2222-2222-222222222222",
      personaId: "p_bob",
      rating: 1,
    });
    expect(result.success).toBe(true);
  });

  it("rejects rating values other than -1 / 1", () => {
    const result = PostBodySchema.safeParse({
      kind: "one_v_one",
      debateMessageId: "22222222-2222-2222-2222-222222222222",
      personaId: "p_bob",
      rating: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects comment longer than 280 chars", () => {
    const result = PostBodySchema.safeParse({
      kind: "one_v_one",
      debateMessageId: "22222222-2222-2222-2222-222222222222",
      personaId: "p_bob",
      rating: -1,
      comment: "x".repeat(281),
    });
    expect(result.success).toBe(false);
  });

  it("requires either evaluationId or debateId on GET, not both", () => {
    expect(GetQuerySchema.safeParse({}).success).toBe(false);
    expect(GetQuerySchema.safeParse({
      evaluationId: "11111111-1111-1111-1111-111111111111",
      debateId: "22222222-2222-2222-2222-222222222222",
    }).success).toBe(false);
    expect(GetQuerySchema.safeParse({
      evaluationId: "11111111-1111-1111-1111-111111111111",
    }).success).toBe(true);
  });

  it("accepts a valid round-table DELETE body", () => {
    const result = DeleteBodySchema.safeParse({
      kind: "round_table",
      evaluationId: "11111111-1111-1111-1111-111111111111",
      roundNumber: 1,
      messageIndex: 3,
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid 1v1 DELETE body", () => {
    const result = DeleteBodySchema.safeParse({
      kind: "one_v_one",
      debateMessageId: "22222222-2222-2222-2222-222222222222",
    });
    expect(result.success).toBe(true);
  });
});
