"use client";

import { useState } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";

interface ReviewFeedbackProps {
  reviewId: string;
  personaId: string;
  initialValue?: -1 | 0 | 1;
  locale: string;
}

export function ReviewFeedback({
  reviewId,
  personaId,
  initialValue = 0,
  locale,
}: ReviewFeedbackProps) {
  const [value, setValue] = useState<-1 | 0 | 1>(initialValue);
  const [pending, setPending] = useState(false);

  async function vote(next: -1 | 1) {
    if (pending) return;
    const prev = value;
    setPending(true);
    if (prev === next) {
      setValue(0);
      const res = await fetch(
        `/api/persona-feedback?review_id=${encodeURIComponent(reviewId)}`,
        { method: "DELETE" },
      );
      if (!res.ok) setValue(prev);
    } else {
      setValue(next);
      const res = await fetch("/api/persona-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          review_id: reviewId,
          persona_id: personaId,
          value: next,
        }),
      });
      if (!res.ok) setValue(prev);
    }
    setPending(false);
  }

  const prompt = locale === "zh" ? "这个视角有帮助吗？" : "Was this perspective helpful?";
  const upLabel = locale === "zh" ? "有用" : "Helpful";
  const downLabel = locale === "zh" ? "不准确" : "Off-base";

  return (
    <div className="no-print flex items-center gap-2 pt-3 mt-1 border-t border-[rgb(var(--border-default-rgb)/0.40)]">
      <span className="text-[11px] text-[color:var(--text-tertiary)] mr-1">{prompt}</span>
      <button
        type="button"
        disabled={pending}
        onClick={() => vote(1)}
        aria-label={upLabel}
        aria-pressed={value === 1}
        className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition-colors disabled:opacity-60 ${
          value === 1
            ? "border-[#4ADE80]/50 bg-[#4ADE80]/10 text-[#4ADE80]"
            : "border-[color:var(--border-default)] text-[color:var(--text-tertiary)] hover:border-[#4ADE80]/30 hover:text-[color:var(--text-secondary)]"
        }`}
      >
        <ThumbsUp className="h-3 w-3" />
        <span>{upLabel}</span>
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => vote(-1)}
        aria-label={downLabel}
        aria-pressed={value === -1}
        className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition-colors disabled:opacity-60 ${
          value === -1
            ? "border-[#F87171]/50 bg-[#F87171]/10 text-[#F87171]"
            : "border-[color:var(--border-default)] text-[color:var(--text-tertiary)] hover:border-[#F87171]/30 hover:text-[color:var(--text-secondary)]"
        }`}
      >
        <ThumbsDown className="h-3 w-3" />
        <span>{downLabel}</span>
      </button>
    </div>
  );
}
