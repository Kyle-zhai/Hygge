"use client";

import { useReducer, useCallback, useEffect } from "react";
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
  | { type: "unvote_error"; previous: { rating: FeedbackRating | null; comment: string } }
  | { type: "hydrate"; rating: FeedbackRating | null; comment: string };

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
    case "hydrate":
      // Only adopt server state when no in-flight mutation. Otherwise we'd
      // clobber the user's optimistic vote with stale server state.
      if (state.pending) return state;
      return { rating: action.rating, comment: action.comment, pending: false };
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

  useEffect(() => {
    if (!initial) return;
    dispatch({ type: "hydrate", rating: initial.rating, comment: initial.comment ?? "" });
  }, [initial?.rating, initial?.comment]);

  const vote = useCallback(
    async (rating: FeedbackRating, comment = "") => {
      if (state.pending) return;
      const previous = { rating: state.rating, comment: state.comment };
      dispatch({ type: "vote_start", rating, comment });
      try {
        const body = ((): Record<string, unknown> => {
          if (address.kind === "round_table") {
            return {
              kind: "round_table" as const,
              evaluationId: address.evaluationId,
              roundNumber: address.roundNumber,
              messageIndex: address.messageIndex,
              personaId,
              rating,
              comment: comment || null,
            };
          }
          if (address.kind === "one_v_one") {
            return {
              kind: "one_v_one" as const,
              debateMessageId: address.debateMessageId,
              personaId,
              rating,
              comment: comment || null,
            };
          }
          return {
            kind: "decision_mechanism" as const,
            mechanismRunId: address.mechanismRunId,
            utteranceIndex: address.utteranceIndex,
            personaId,
            rating,
            comment: comment || null,
          };
        })();
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
    [address, personaId, state.rating, state.comment, state.pending],
  );

  const unvote = useCallback(async () => {
    if (state.pending) return;
    const previous = { rating: state.rating, comment: state.comment };
    dispatch({ type: "unvote_start" });
    try {
      const body = ((): Record<string, unknown> => {
        if (address.kind === "round_table") {
          return {
            kind: "round_table" as const,
            evaluationId: address.evaluationId,
            roundNumber: address.roundNumber,
            messageIndex: address.messageIndex,
          };
        }
        if (address.kind === "one_v_one") {
          return {
            kind: "one_v_one" as const,
            debateMessageId: address.debateMessageId,
          };
        }
        return {
          kind: "decision_mechanism" as const,
          mechanismRunId: address.mechanismRunId,
          utteranceIndex: address.utteranceIndex,
        };
      })();
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
  }, [address, state.rating, state.comment, state.pending]);

  return { ...state, vote, unvote };
}
