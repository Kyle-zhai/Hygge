"use client";

import { useState } from "react";
import { Bookmark, BookmarkCheck, Loader2, Star, Trash2 } from "lucide-react";

interface PersonaDetail {
  id: string;
  identity: { name: string; avatar: string; tagline: string };
  demographics: { occupation: string; age?: number; gender?: string };
  description?: string | null;
  tags?: string[] | null;
  evaluation_lens?: { primary_question?: string } | null;
  latent_needs?: string[] | null;
  scenarios?: string[] | null;
  uses_count?: number;
}

interface ReviewRow {
  id: string;
  rating: number;
  content: string | null;
  created_at: string;
  author_id: string;
}

interface Stats {
  review_count: number;
  average_rating: number | null;
}

interface Props {
  locale: string;
  personaId: string;
  persona: PersonaDetail;
  stats: Stats;
  initialReviews: ReviewRow[];
  initialIsSaved: boolean;
  canReview: boolean;
  currentUserId: string | null;
  hasOwnReview: boolean;
}

function L(locale: string, zh: string, en: string): string {
  return locale === "zh" ? zh : en;
}

function formatDate(iso: string, locale: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function MarketplaceDetailClient({
  locale,
  personaId,
  persona,
  stats,
  initialReviews,
  initialIsSaved,
  canReview,
  currentUserId,
  hasOwnReview,
}: Props) {
  const [reviews, setReviews] = useState<ReviewRow[]>(initialReviews);
  const [saved, setSaved] = useState(initialIsSaved);
  const [savingBookmark, setSavingBookmark] = useState(false);

  const existingOwn = reviews.find((r) => r.author_id === currentUserId);
  const [draftRating, setDraftRating] = useState(existingOwn?.rating ?? 0);
  const [draftContent, setDraftContent] = useState(existingOwn?.content ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const summary = {
    count: reviews.length,
    avg: reviews.length
      ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
      : stats.average_rating,
  };

  async function toggleSave() {
    setSavingBookmark(true);
    const next = !saved;
    setSaved(next);
    try {
      const res = await fetch(`/api/personas/${personaId}/save`, {
        method: next ? "POST" : "DELETE",
      });
      if (!res.ok) setSaved(!next);
    } catch {
      setSaved(!next);
    } finally {
      setSavingBookmark(false);
    }
  }

  async function submitReview() {
    if (!draftRating) {
      setError(L(locale, "请先选择评分", "Please select a rating"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/marketplace/${personaId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: draftRating, content: draftContent }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Submit failed");
      const newReview: ReviewRow = {
        id: body.review.id,
        rating: body.review.rating,
        content: body.review.content,
        created_at: body.review.created_at,
        author_id: currentUserId!,
      };
      setReviews((prev) => {
        const filtered = prev.filter((r) => r.author_id !== currentUserId);
        return [newReview, ...filtered];
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteOwnReview() {
    if (!confirm(L(locale, "确认删除你的评价？", "Delete your review?"))) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/marketplace/${personaId}/reviews`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete failed");
      setReviews((prev) => prev.filter((r) => r.author_id !== currentUserId));
      setDraftRating(0);
      setDraftContent("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="rounded-2xl border border-[color:var(--border-default)] bg-[color:var(--bg-secondary)] p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[color:var(--bg-tertiary)] text-2xl">
            {persona.identity.avatar}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold text-[color:var(--text-primary)] tracking-[-0.01em]">
              {persona.identity.name}
            </h1>
            <p className="text-sm text-[color:var(--text-secondary)] mt-0.5">{persona.demographics.occupation}</p>
            <p className="text-xs text-[color:var(--text-tertiary)] mt-1.5">{persona.identity.tagline}</p>
          </div>
          <button
            type="button"
            onClick={toggleSave}
            disabled={savingBookmark}
            className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border-default)] px-3 py-1.5 text-xs text-[color:var(--accent-warm)] hover:border-[rgb(var(--accent-warm-rgb)/0.40)] hover:bg-[rgb(var(--accent-warm-rgb)/0.05)] transition-colors disabled:opacity-50"
          >
            {saved ? <BookmarkCheck className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
            {saved ? L(locale, "已收藏", "Saved") : L(locale, "收藏", "Save")}
          </button>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-4 text-xs text-[color:var(--text-secondary)]">
          {summary.avg !== null && summary.count > 0 && (
            <div className="flex items-center gap-1.5">
              <Star className="h-3.5 w-3.5 fill-[color:var(--accent-warm)] text-[color:var(--accent-warm)]" />
              <span className="font-semibold text-[color:var(--text-primary)]">{summary.avg?.toFixed(1)}</span>
              <span>
                ({summary.count} {L(locale, "评价", "reviews")})
              </span>
            </div>
          )}
          {typeof persona.uses_count === "number" && (
            <span>
              {persona.uses_count} {L(locale, "次使用", "uses")}
            </span>
          )}
          {(persona.tags ?? []).slice(0, 5).map((t) => (
            <span key={t} className="rounded bg-[color:var(--bg-tertiary)] px-2 py-0.5 text-[10px] text-[color:var(--text-secondary)]">
              {t}
            </span>
          ))}
        </div>
      </header>

      {/* Detail sections */}
      <section className="rounded-2xl border border-[color:var(--border-default)] bg-[color:var(--bg-secondary)] p-6 space-y-5">
        {persona.description && (
          <div>
            <h2 className="text-[10px] font-semibold uppercase tracking-widest text-[color:var(--accent-warm)] mb-2">
              {L(locale, "简介", "About")}
            </h2>
            <p className="text-sm text-[color:var(--text-primary)] leading-relaxed whitespace-pre-wrap">
              {persona.description}
            </p>
          </div>
        )}

        {persona.evaluation_lens?.primary_question && (
          <div>
            <h2 className="text-[10px] font-semibold uppercase tracking-widest text-[color:var(--accent-warm)] mb-2">
              {L(locale, "评估视角", "Evaluation Lens")}
            </h2>
            <p className="text-sm text-[color:var(--text-secondary)] leading-relaxed italic">
              &ldquo;{persona.evaluation_lens.primary_question}&rdquo;
            </p>
          </div>
        )}

        {(persona.latent_needs ?? []).length > 0 && (
          <div>
            <h2 className="text-[10px] font-semibold uppercase tracking-widest text-[color:var(--accent-warm)] mb-2">
              {L(locale, "潜在需求", "Latent Needs")}
            </h2>
            <ul className="space-y-1.5">
              {(persona.latent_needs ?? []).map((n, i) => (
                <li key={i} className="text-sm text-[color:var(--text-secondary)] leading-relaxed">
                  • {n}
                </li>
              ))}
            </ul>
          </div>
        )}

        {(persona.scenarios ?? []).length > 0 && (
          <div>
            <h2 className="text-[10px] font-semibold uppercase tracking-widest text-[color:var(--accent-warm)] mb-2">
              {L(locale, "适用场景", "Best for")}
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {(persona.scenarios ?? []).map((s) => (
                <span
                  key={s}
                  className="rounded-full border border-[color:var(--border-default)] bg-[color:var(--bg-tertiary)] px-2.5 py-1 text-xs text-[color:var(--text-secondary)]"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Reviews */}
      <section className="rounded-2xl border border-[color:var(--border-default)] bg-[color:var(--bg-secondary)] p-6">
        <div className="flex items-baseline justify-between mb-5">
          <h2 className="text-sm font-semibold text-[color:var(--text-primary)]">
            {L(locale, "评价", "Reviews")}
          </h2>
          <span className="text-xs text-[color:var(--text-tertiary)]">{reviews.length}</span>
        </div>

        {canReview && (
          <div className="mb-6 rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-primary)] p-4">
            <p className="text-xs text-[color:var(--text-secondary)] mb-2">
              {existingOwn
                ? L(locale, "更新你的评价", "Update your review")
                : L(locale, "留下你的评价", "Leave a review")}
            </p>
            <div className="flex items-center gap-1 mb-3">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setDraftRating(n)}
                  className="p-1"
                  aria-label={`${n} stars`}
                >
                  <Star
                    className={`h-5 w-5 transition-colors ${
                      n <= draftRating
                        ? "fill-[color:var(--accent-warm)] text-[color:var(--accent-warm)]"
                        : "text-[color:var(--border-hover)] hover:text-[color:var(--text-secondary)]"
                    }`}
                  />
                </button>
              ))}
            </div>
            <textarea
              value={draftContent}
              onChange={(e) => setDraftContent(e.target.value)}
              placeholder={L(locale, "分享你的使用感受（可选）", "Share your experience (optional)")}
              rows={3}
              className="w-full resize-none rounded-lg border border-[color:var(--border-default)] bg-[color:var(--bg-secondary)] px-3 py-2 text-sm text-[color:var(--text-primary)] placeholder:text-[color:var(--text-tertiary)] focus:outline-none focus:border-[rgb(var(--accent-warm-rgb)/0.40)]"
            />
            {error && <p className="mt-2 text-xs text-[#EF4444]">{error}</p>}
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={submitReview}
                disabled={submitting || !draftRating}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[color:var(--accent-warm)] px-4 py-2 text-xs font-medium text-[color:var(--bg-primary)] hover:bg-[color:var(--accent-warm-hover)] disabled:opacity-50"
              >
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {existingOwn
                  ? L(locale, "更新", "Update")
                  : L(locale, "发布", "Post")}
              </button>
              {hasOwnReview && (
                <button
                  type="button"
                  onClick={deleteOwnReview}
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 text-xs text-[color:var(--text-secondary)] hover:text-[#EF4444] transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {L(locale, "删除", "Delete")}
                </button>
              )}
            </div>
          </div>
        )}

        {reviews.length === 0 ? (
          <p className="text-xs text-[color:var(--text-tertiary)] py-4">
            {L(locale, "暂无评价", "No reviews yet")}
          </p>
        ) : (
          <ul className="space-y-4">
            {reviews.map((r) => (
              <li key={r.id} className="border-t border-[rgb(var(--border-default-rgb)/0.60)] pt-4 first:border-t-0 first:pt-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={n}
                        className={`h-3.5 w-3.5 ${
                          n <= r.rating
                            ? "fill-[color:var(--accent-warm)] text-[color:var(--accent-warm)]"
                            : "text-[color:var(--border-hover)]"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-[10px] text-[color:var(--text-tertiary)]">
                    {formatDate(r.created_at, locale)}
                  </span>
                  {r.author_id === currentUserId && (
                    <span className="text-[10px] text-[rgb(var(--accent-warm-rgb)/0.80)]">
                      {L(locale, "你", "you")}
                    </span>
                  )}
                </div>
                {r.content && (
                  <p className="text-sm text-[color:var(--text-secondary)] leading-relaxed whitespace-pre-wrap">
                    {r.content}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
