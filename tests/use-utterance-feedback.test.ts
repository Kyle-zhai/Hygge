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

  it("unvote_error rolls back to previous state", () => {
    const s = feedbackReducer(
      { rating: null, comment: "", pending: true },
      { type: "unvote_error", previous: { rating: 1, comment: "x" } },
    );
    expect(s).toEqual({ rating: 1, comment: "x", pending: false });
  });

  it("hydrate adopts server state when not pending", () => {
    const s = feedbackReducer(
      { rating: null, comment: "", pending: false },
      { type: "hydrate", rating: 1, comment: "loaded" },
    );
    expect(s).toEqual({ rating: 1, comment: "loaded", pending: false });
  });

  it("hydrate is a no-op while pending (don't clobber in-flight vote)", () => {
    const before: FeedbackState = { rating: -1, comment: "x", pending: true };
    const after = feedbackReducer(before, { type: "hydrate", rating: 1, comment: "stale" });
    expect(after).toBe(before);
  });
});
