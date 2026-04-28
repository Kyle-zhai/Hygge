"use client";

import { useReducer, useCallback } from "react";
import type { UtteranceAddress, FeedbackRating } from "./types";

export interface FeedbackState {
  rating: FeedbackRating | null;
  comment: string;
  pending: boolean;
}

export type FeedbackAction =
  | { type: "vote_start"; rating: FeedbackRating; comment: string }
  | { type: "vote_success" }
  | { type: "vote_error"; previous: { rating: FeedbackRating | null; comment: string } }
  | { type: "unvote_start" }
  | { type: "unvote_success" }
  | { type: "unvote_error"; previous: { rating: FeedbackRating | null; comment: string } };

export function feedbackReducer(state: FeedbackState, action: FeedbackAction): FeedbackState {
  switch (action.type) {
    case "vote_start":
      return { rating: action.rating, comment: action.comment, pending: true };
    case "vote_success":
      return { ...state, pending: false };
    case "vote_error":
      return { rating: action.previous.rating, comment: action.previous.comment, pending: false };
    case "unvote_start":
      return { ...state, rating: null, pending: true };
    case "unvote_success":
      return { ...state, pending: false };
    case "unvote_error":
      return { rating: action.previous.rating, comment: action.previous.comment, pending: false };
  }
}

interface Input {
  address: UtteranceAddress;
  personaId: string;
  initial?: { rating: FeedbackRating | null; comment: string | null } | null;
}

export function useUtteranceFeedback({ address, personaId, initial }: Input) {
  const [state, dispatch] = useReducer(feedbackReducer, {
    rating: initial?.rating ?? null,
    comment: initial?.comment ?? "",
    pending: false,
  });

  const vote = useCallback(
    async (rating: FeedbackRating, comment = "") => {
      const previous = { rating: state.rating, comment: state.comment };
      dispatch({ type: "vote_start", rating, comment });
      try {
        const body =
          address.kind === "round_table"
            ? {
                kind: "round_table" as const,
                evaluationId: address.evaluationId,
                roundNumber: address.roundNumber,
                messageIndex: address.messageIndex,
                personaId,
                rating,
                comment: comment || null,
              }
            : {
                kind: "one_v_one" as const,
                debateMessageId: address.debateMessageId,
                personaId,
                rating,
                comment: comment || null,
              };
        const res = await fetch("/api/feedback/utterance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(await res.text());
        dispatch({ type: "vote_success" });
      } catch (e) {
        dispatch({ type: "vote_error", previous });
        throw e;
      }
    },
    [address, personaId, state.rating, state.comment],
  );

  const unvote = useCallback(async () => {
    const previous = { rating: state.rating, comment: state.comment };
    dispatch({ type: "unvote_start" });
    try {
      const body =
        address.kind === "round_table"
          ? {
              kind: "round_table" as const,
              evaluationId: address.evaluationId,
              roundNumber: address.roundNumber,
              messageIndex: address.messageIndex,
            }
          : {
              kind: "one_v_one" as const,
              debateMessageId: address.debateMessageId,
            };
      const res = await fetch("/api/feedback/utterance", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      dispatch({ type: "unvote_success" });
    } catch (e) {
      dispatch({ type: "unvote_error", previous });
      throw e;
    }
  }, [address, state.rating, state.comment]);

  return { ...state, vote, unvote };
}
