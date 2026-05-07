import { z } from "zod";

// zod 4's z.string().uuid() enforces RFC 9562 (rejects fixtures like
// "11111111-1111-1111-1111-111111111111" because the version digit isn't 1-8).
// Use z.guid() — generic dashed-hex GUID validation, no version-bit check —
// which accepts any UUID-shaped string from Postgres / fixtures alike.
const UuidLike = z.guid();

const Rating = z.union([z.literal(-1), z.literal(1)]);
const Comment = z.string().max(280).nullable().optional();

export const PostBodySchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("round_table"),
    evaluationId: UuidLike,
    roundNumber: z.number().int().min(1).max(10),
    messageIndex: z.number().int().min(0).max(50),
    personaId: z.string().min(1).max(128),
    rating: Rating,
    comment: Comment,
  }),
  z.object({
    kind: z.literal("one_v_one"),
    debateMessageId: UuidLike,
    personaId: z.string().min(1).max(128),
    rating: Rating,
    comment: Comment,
  }),
  z.object({
    kind: z.literal("decision_mechanism"),
    mechanismRunId: UuidLike,
    utteranceIndex: z.number().int().min(0).max(500),
    personaId: z.string().min(1).max(128),
    rating: Rating,
    comment: Comment,
  }),
]);

export const DeleteBodySchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("round_table"),
    evaluationId: UuidLike,
    roundNumber: z.number().int().min(1).max(10),
    messageIndex: z.number().int().min(0).max(50),
  }),
  z.object({
    kind: z.literal("one_v_one"),
    debateMessageId: UuidLike,
  }),
  z.object({
    kind: z.literal("decision_mechanism"),
    mechanismRunId: UuidLike,
    utteranceIndex: z.number().int().min(0).max(500),
  }),
]);

export const GetQuerySchema = z
  .object({
    evaluationId: UuidLike.optional(),
    debateId: UuidLike.optional(),
    decisionBriefId: UuidLike.optional(),
  })
  .refine(
    (q) => {
      const present = [q.evaluationId, q.debateId, q.decisionBriefId].filter(Boolean).length;
      return present === 1;
    },
    { message: "exactly one of evaluationId / debateId / decisionBriefId is required" },
  );

export type PostBody = z.infer<typeof PostBodySchema>;
export type DeleteBody = z.infer<typeof DeleteBodySchema>;
export type GetQuery = z.infer<typeof GetQuerySchema>;
