"use client";

import { useState } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { useUtteranceFeedback } from "@/lib/feedback/use-utterance-feedback";
import type { UtteranceAddress, FeedbackRating } from "@/lib/feedback/types";

interface Props {
  address: UtteranceAddress;
  personaId: string;
  initial?: { rating: FeedbackRating | null; comment: string | null } | null;
  // Show the buttons inline (true) or only on parent hover (false, default)
  alwaysVisible?: boolean;
}

export function UtteranceFeedbackButtons({ address, personaId, initial, alwaysVisible }: Props) {
  const { rating, comment, pending, vote, unvote } = useUtteranceFeedback({ address, personaId, initial });
  const [showCommentBox, setShowCommentBox] = useState(false);
  const [draft, setDraft] = useState(comment);

  const visibility = alwaysVisible
    ? "opacity-100"
    : "opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity";

  async function handleUp() {
    if (rating === 1) {
      await unvote().catch(() => {});
    } else {
      await vote(1).catch(() => {});
    }
  }

  function handleDown() {
    if (rating === -1) {
      // Already downvoted — clicking again unvotes
      unvote().catch(() => {});
      setShowCommentBox(false);
    } else {
      // First downvote — open the optional comment box and pre-vote with empty comment
      vote(-1).catch(() => {});
      setShowCommentBox(true);
    }
  }

  async function handleSubmitComment() {
    await vote(-1, draft).catch(() => {});
    setShowCommentBox(false);
  }

  return (
    <div className={`flex flex-col gap-1 items-end ${visibility}`}>
      <div className="flex gap-1">
        <button
          type="button"
          aria-label="In character"
          aria-pressed={rating === 1}
          disabled={pending}
          onClick={handleUp}
          className={`p-1 rounded transition-colors ${
            rating === 1
              ? "text-[color:var(--accent-warm)] bg-[rgb(var(--accent-warm-rgb)/0.15)]"
              : "text-[color:var(--text-tertiary)] hover:text-[color:var(--text-primary)] hover:bg-[color:var(--bg-tertiary)]"
          }`}
        >
          <ThumbsUp className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          aria-label="Not in character"
          aria-pressed={rating === -1}
          disabled={pending}
          onClick={handleDown}
          className={`p-1 rounded transition-colors ${
            rating === -1
              ? "text-[#F87171] bg-[#F87171]/10"
              : "text-[color:var(--text-tertiary)] hover:text-[color:var(--text-primary)] hover:bg-[color:var(--bg-tertiary)]"
          }`}
        >
          <ThumbsDown className="h-3.5 w-3.5" />
        </button>
      </div>
      {showCommentBox && (
        <div className="flex flex-col gap-1 w-full">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 280))}
            placeholder="Why doesn't this feel like them? (optional, 280 chars)"
            rows={2}
            className="text-xs rounded border border-[color:var(--border-default)] bg-[color:var(--bg-tertiary)] p-2 text-[color:var(--text-primary)] placeholder:text-[color:var(--text-tertiary)] resize-none w-full max-w-xs"
          />
          <div className="flex gap-1 justify-end">
            <button
              type="button"
              onClick={() => setShowCommentBox(false)}
              className="text-xs px-2 py-1 text-[color:var(--text-tertiary)] hover:text-[color:var(--text-primary)]"
            >
              Skip
            </button>
            <button
              type="button"
              onClick={handleSubmitComment}
              disabled={pending}
              className="text-xs px-2 py-1 rounded bg-[color:var(--accent-warm)] text-white hover:opacity-90 disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
