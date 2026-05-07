// src/lib/feedback/types.ts

export type FeedbackRating = -1 | 1;

export type UtteranceAddress =
  | {
      kind: "round_table";
      evaluationId: string;
      roundNumber: number;   // 1-based, matches DebateRound.round
      messageIndex: number;  // 0-based, position within round.messages
    }
  | {
      kind: "one_v_one";
      debateMessageId: string;
    }
  | {
      kind: "decision_mechanism";
      mechanismRunId: string;
      utteranceIndex: number; // 0-based, position within raw_transcript[]
    };

export interface FeedbackVote {
  id: string;
  userId: string;
  personaId: string;
  rating: FeedbackRating;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FeedbackVoteWithAddress extends FeedbackVote {
  address: UtteranceAddress;
}
