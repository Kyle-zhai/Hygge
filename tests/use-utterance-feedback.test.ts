import { describe, it, expect } from "vitest";
import { feedbackReducer, type FeedbackState } from "@/lib/feedback/use-utterance-feedback";

const empty: FeedbackState = { rating: null, comment: "", pending: false };

describe("feedbackReducer", () => {
  it("optimistic vote sets rating + pending", () => {
    const s = feedbackReducer(empty, { type: "vote_start", rating: 1, comment: "" });
    expect(s).toEqual({ rating: 1, comment: "", pending: true });
  });

  it("vote_success clears pending, keeps rating", () => {
    const s = feedbackReducer(
      { rating: 1, comment: "", pending: true },
      { type: "vote_success" },
    );
    expect(s).toEqual({ rating: 1, comment: "", pending: false });
  });

  it("vote_error rolls back to previous state", () => {
    const s = feedbackReducer(
      { rating: 1, comment: "x", pending: true },
      { type: "vote_error", previous: { rating: -1, comment: "old" } },
    );
    expect(s).toEqual({ rating: -1, comment: "old", pending: false });
  });

  it("unvote_start sets pending and rating to null", () => {
    const s = feedbackReducer(
      { rating: 1, comment: "", pending: false },
      { type: "unvote_start" },
    );
    expect(s).toEqual({ rating: null, comment: "", pending: true });
  });

  it("unvote_success keeps rating null", () => {
    const s = feedbackReducer(
      { rating: null, comment: "", pending: true },
      { type: "unvote_success" },
    );
    expect(s).toEqual({ rating: null, comment: "", pending: false });
  });
});
