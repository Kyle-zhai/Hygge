"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, FileText, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import {
  subscribeToEvaluation,
  unsubscribe,
  type ReviewPayload,
} from "@/lib/supabase/realtime";

type Translator = ReturnType<typeof useTranslations>;

// --- Types ---

interface PersonaInfo {
  id: string;
  name: string;
  avatar: string;
}

interface DiscussionFeedProps {
  evaluationId: string;
  personas: PersonaInfo[];
  initialCompletedReviews: ReviewPayload[];
  initialStatus: string;
  topicTitle: string;
  mode: "topic" | "product";
  locale: string;
}

type CardState = "waiting" | "thinking" | "completed";

const CONCURRENCY = 3;

// --- Helpers ---

function getStanceLabel(
  scores: Record<string, number | string> | null | undefined,
  t: Translator,
): { label: string; color: string } {
  const values = scores ? Object.values(scores) : [];
  if (values.length === 0) return { label: "—", color: "#666462" };

  // Topic mode: string stances
  if (typeof values[0] === "string") {
    const stanceOrder: Record<string, number> = {
      strongly_support: 2,
      support: 1,
      neutral: 0,
      oppose: -1,
      strongly_oppose: -2,
    };
    const avg =
      values.reduce<number>(
        (sum, v) => sum + (stanceOrder[v as string] ?? 0),
        0,
      ) / values.length;
    if (avg > 0.5) return { label: t("stanceSupportive"), color: "#4ADE80" };
    if (avg < -0.5) return { label: t("stanceOpposed"), color: "#F87171" };
    return { label: t("stanceNeutral"), color: "#FBBF24" };
  }

  // Product mode: numeric scores
  const numeric = values.filter((v): v is number => typeof v === "number");
  if (numeric.length === 0) return { label: "—", color: "#666462" };
  const avg = numeric.reduce((a, b) => a + b, 0) / numeric.length;
  return {
    label: avg.toFixed(1),
    color: avg >= 7 ? "#4ADE80" : avg >= 4 ? "#FBBF24" : "#F87171",
  };
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).trimEnd() + "...";
}

// --- Sub-components ---

function WaveDots() {
  return (
    <span className="inline-flex items-center gap-[2px] ml-1.5" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="inline-block h-[4px] w-[4px] rounded-full bg-[#C4A882]"
          style={{
            animation: "wave-bounce 1.4s ease-in-out infinite",
            animationDelay: `${i * 0.16}s`,
          }}
        />
      ))}
    </span>
  );
}

function ThinkingCard({ persona, t }: { persona: PersonaInfo; t: Translator }) {
  return (
    <div
      className="rounded-xl p-[1px]"
      role="status"
      aria-busy="true"
      aria-label={`${persona.name} — ${t("thinking")}`}
      style={{
        background:
          "conic-gradient(from var(--border-angle), transparent 60%, #C4A882 100%)",
        animation: "border-rotate 2s linear infinite",
      }}
    >
      <div className="flex items-center gap-3 rounded-[11px] bg-[#141414] p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1C1C1C] text-base">
          {persona.avatar}
        </div>
        <span className="flex-1 text-sm font-medium text-[#EAEAE8]">
          {persona.name}
        </span>
        <span className="flex items-center text-xs text-[#C4A882]">
          {t("thinking")}
          <WaveDots />
        </span>
      </div>
    </div>
  );
}

function WaitingCard({ persona, t }: { persona: PersonaInfo; t: Translator }) {
  return (
    <div
      className="flex items-center gap-3 rounded-xl border border-[#2A2A2A] bg-[#141414] p-4 opacity-60"
      role="status"
      aria-label={t("waitingFor", { name: persona.name })}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1C1C1C] text-base">
        {persona.avatar}
      </div>
      <span className="flex-1 text-sm font-medium text-[#EAEAE8]">
        {persona.name}
      </span>
      <span className="text-xs text-[#9B9594]">{t("waiting")}</span>
    </div>
  );
}

function CompletedCard({
  persona,
  review,
  expanded,
  onToggle,
  t,
}: {
  persona: PersonaInfo;
  review: ReviewPayload;
  expanded: boolean;
  onToggle: () => void;
  t: Translator;
}) {
  const stance = getStanceLabel(review.scores, t);
  const reviewText = review.review_text || "";
  const strengths = review.strengths ?? [];
  const weaknesses = review.weaknesses ?? [];

  return (
    <div className="rounded-xl border border-[#4ADE80]/20 bg-[#4ADE80]/[0.03] p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1C1C1C] text-base">
          {persona.avatar}
        </div>
        <span className="flex-1 text-sm font-medium text-[#EAEAE8]">
          {persona.name}
        </span>
        <span
          className="rounded-full px-2.5 py-0.5 text-xs font-medium"
          style={{
            backgroundColor: stance.color + "20",
            color: stance.color,
          }}
        >
          {stance.label}
        </span>
      </div>

      <div className="mt-3 pl-12">
        <p className="text-sm leading-relaxed text-[#9B9594]">
          &ldquo;{expanded ? reviewText : truncate(reviewText, 150)}&rdquo;
        </p>

        {expanded && (strengths.length > 0 || weaknesses.length > 0) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {strengths.slice(0, 3).map((s, i) => (
              <span
                key={`s-${i}`}
                className="rounded-md bg-[#4ADE80]/10 px-2 py-0.5 text-xs text-[#4ADE80]"
              >
                {s}
              </span>
            ))}
            {weaknesses.slice(0, 3).map((w, i) => (
              <span
                key={`w-${i}`}
                className="rounded-md bg-[#F87171]/10 px-2 py-0.5 text-xs text-[#F87171]"
              >
                {w}
              </span>
            ))}
          </div>
        )}

        <button
          onClick={onToggle}
          className="mt-2 flex items-center gap-1 text-xs text-[#9B9594] transition-colors hover:text-[#EAEAE8]"
          aria-expanded={expanded}
        >
          {expanded ? (
            <>
              {t("showLess")} <ChevronUp className="h-3 w-3" />
            </>
          ) : (
            <>
              {t("showMore")} <ChevronDown className="h-3 w-3" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function SummaryCard({
  summaryReport,
  mode,
  evaluationId,
  locale,
  t,
}: {
  summaryReport: any;
  mode: "topic" | "product";
  evaluationId: string;
  locale: string;
  t: Translator;
}) {
  const router = useRouter();

  const consensusPoints: string[] =
    (summaryReport?.persona_analysis?.consensus || [])
      .map((c: any) => c?.point)
      .filter((p: unknown): p is string => typeof p === "string" && p.length > 0);

  const excerpt =
    mode === "topic" && typeof summaryReport?.synthesis === "string"
      ? truncate(summaryReport.synthesis, 300)
      : consensusPoints.slice(0, 2).join(" ") || t("reportReady");

  const consensusScore = summaryReport?.consensus_score;
  const showConsensus =
    mode === "topic" &&
    typeof consensusScore === "number" &&
    Number.isFinite(consensusScore);

  return (
    <div className="rounded-xl border border-[#E2DDD5]/20 bg-[#E2DDD5]/[0.03] p-5">
      <div className="flex items-center gap-2 mb-3">
        <FileText className="h-4 w-4 text-[#E2DDD5]" />
        <span className="text-sm font-semibold text-[#EAEAE8]">
          {t("discussionSummary")}
        </span>
        {showConsensus && (
          <span className="ml-auto rounded-full bg-[#E2DDD5]/15 px-2.5 py-0.5 text-xs font-medium text-[#E2DDD5]">
            {t("consensusBadge", { score: Math.round(consensusScore) })}
          </span>
        )}
      </div>
      <p className="text-sm leading-relaxed text-[#9B9594]">{excerpt}</p>
      <Button
        onClick={() =>
          router.push(`/${locale}/evaluate/${evaluationId}/result`)
        }
        className="mt-4 bg-[#E2DDD5] text-[#0C0C0C] hover:bg-[#D4CFC7] font-semibold px-6"
      >
        {t("viewFullReport")}
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}

// --- Main Component ---

export function DiscussionFeed({
  evaluationId,
  personas,
  initialCompletedReviews,
  initialStatus,
  topicTitle,
  mode,
  locale,
}: DiscussionFeedProps) {
  const t = useTranslations("evaluation");
  const [reviews, setReviews] = useState<ReviewPayload[]>(initialCompletedReviews);
  const [status, setStatus] = useState(initialStatus);
  const [summaryReport, setSummaryReport] = useState<any>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const feedEndRef = useRef<HTMLDivElement>(null);
  const prevReviewCount = useRef(reviews.length);
  // Mirror reviews into a ref so pollForMissing can read latest without
  // becoming a changing dependency — otherwise the interval would reset
  // every time a review arrived and never actually fire.
  const reviewsRef = useRef(reviews);
  useEffect(() => {
    reviewsRef.current = reviews;
  }, [reviews]);

  // maybeSingle tolerates the edge case where the row isn't yet visible.
  const fetchSummaryReport = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("summary_reports")
      .select("*")
      .eq("evaluation_id", evaluationId)
      .maybeSingle();
    if (data) setSummaryReport(data);
  }, [evaluationId]);

  // Realtime subscription
  useEffect(() => {
    if (status === "completed" || status === "failed") return;

    const channel = subscribeToEvaluation(evaluationId, {
      onStatusChange: (newStatus) => {
        setStatus(newStatus);
        if (newStatus === "completed") fetchSummaryReport();
      },
      onNewReview: (review) => {
        setReviews((prev) => {
          if (prev.some((r) => r.persona_id === review.persona_id)) return prev;
          return [...prev, review];
        });
      },
    });

    return () => unsubscribe(channel);
  }, [evaluationId, status, fetchSummaryReport]);

  // Fallback polling — deps intentionally exclude `reviews` and `status`
  // so the interval isn't torn down on every state change. Latest values
  // are read from refs at fire time.
  const statusRef = useRef(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const pollForMissing = useCallback(async () => {
    const supabase = createClient();
    const { data: evaluation } = await supabase
      .from("evaluations")
      .select(
        "status, persona_reviews (persona_id, review_text, scores, strengths, weaknesses)",
      )
      .eq("id", evaluationId)
      .maybeSingle();

    if (!evaluation) return;

    if (evaluation.status !== statusRef.current) {
      setStatus(evaluation.status);
      if (evaluation.status === "completed") fetchSummaryReport();
    }

    const existing = new Set(reviewsRef.current.map((r) => r.persona_id));
    const fetched = ((evaluation as any).persona_reviews || []) as ReviewPayload[];
    const newOnes = fetched.filter((r) => !existing.has(r.persona_id));
    if (newOnes.length > 0) {
      setReviews((prev) => [...prev, ...newOnes]);
    }
  }, [evaluationId, fetchSummaryReport]);

  useEffect(() => {
    if (status === "completed" || status === "failed") return;
    const interval = setInterval(pollForMissing, 10000);
    return () => clearInterval(interval);
  }, [status, pollForMissing]);

  // Fetch summary if arrived already completed
  useEffect(() => {
    if (status === "completed" && !summaryReport) fetchSummaryReport();
  }, [status, summaryReport, fetchSummaryReport]);

  // Auto-scroll on new review
  useEffect(() => {
    if (reviews.length > prevReviewCount.current) {
      feedEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
    prevReviewCount.current = reviews.length;
  }, [reviews.length]);

  // Compute card states
  const completedSet = new Set(reviews.map((r) => r.persona_id));
  const reviewMap = new Map(reviews.map((r) => [r.persona_id, r]));
  let thinkingCount = 0;

  const cardStates: Array<{ persona: PersonaInfo; state: CardState; review?: ReviewPayload }> =
    personas.map((p) => {
      if (completedSet.has(p.id)) {
        return { persona: p, state: "completed" as const, review: reviewMap.get(p.id)! };
      }
      if (thinkingCount < CONCURRENCY) {
        thinkingCount++;
        return { persona: p, state: "thinking" as const };
      }
      return { persona: p, state: "waiting" as const };
    });

  const allReviewsDone = completedSet.size >= personas.length;

  function toggleExpand(personaId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(personaId)) next.delete(personaId);
      else next.add(personaId);
      return next;
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      {/* Header */}
      <div className="text-center">
        <p className="text-xs font-medium uppercase tracking-widest text-[#C4A882]">
          {t("roundTable")}
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-[#EAEAE8] tracking-[-0.02em]">
          {topicTitle}
        </h1>
        <p className="mt-1 text-sm text-[#9B9594]">
          {t("perspectives", { count: personas.length })}
        </p>
      </div>

      {/* Feed */}
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {cardStates.map(({ persona, state, review }) => (
            <motion.div
              key={persona.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            >
              {state === "completed" && review ? (
                <CompletedCard
                  persona={persona}
                  review={review}
                  expanded={expandedIds.has(persona.id)}
                  onToggle={() => toggleExpand(persona.id)}
                  t={t}
                />
              ) : state === "thinking" ? (
                <ThinkingCard persona={persona} t={t} />
              ) : (
                <WaitingCard persona={persona} t={t} />
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Summary loading */}
      {allReviewsDone && status !== "completed" && status !== "failed" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          role="status"
          aria-live="polite"
          className="flex items-center justify-center gap-2 py-4 text-sm text-[#9B9594]"
        >
          <FileText className="h-4 w-4 animate-pulse text-[#E2DDD5]" />
          <span>{t("generatingSummary")}</span>
          <WaveDots />
        </motion.div>
      )}

      {/* Summary card */}
      {status === "completed" && summaryReport && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <SummaryCard
            summaryReport={summaryReport}
            mode={mode}
            evaluationId={evaluationId}
            locale={locale}
            t={t}
          />
        </motion.div>
      )}

      {/* Failed state */}
      {status === "failed" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          role="alert"
          className="rounded-xl border border-[#F87171]/20 bg-[#F87171]/[0.03] p-4 text-center text-sm text-[#F87171]"
        >
          {t("discussionFailed")}
        </motion.div>
      )}

      <div ref={feedEndRef} />
    </div>
  );
}
