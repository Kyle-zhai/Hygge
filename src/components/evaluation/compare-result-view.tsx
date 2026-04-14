"use client";

import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { Scale, ArrowRight, ArrowDown, ArrowUp, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PersonaAvatar } from "@/components/persona-avatar";

interface TopicClassification {
  dimensions: Array<{ key: string; label_en: string; label_zh: string; description: string }>;
}

interface ReportData {
  overall_score?: number;
  consensus_score?: number | null;
  market_readiness?: string;
  readiness_label_en?: string;
  readiness_label_zh?: string;
  persona_analysis?: {
    entries?: Array<{ persona_id: string; core_viewpoint: string; scoring_rationale: string }>;
    consensus?: Array<{ point: string; supporting_personas?: string[] }>;
    disagreements?: Array<{ point: string; reason: string }>;
  };
  multi_dimensional_analysis?: Array<{
    dimension: string;
    label_en?: string;
    label_zh?: string;
    score?: number;
    overall_leaning?: string;
    analysis?: string;
    strengths?: string[];
    weaknesses?: string[];
  }>;
  action_items?: Array<{ description: string; priority: string }>;
}

interface ReviewData {
  persona_id: string;
  scores: Record<string, number | string>;
  review_text: string;
  strengths: string[];
  weaknesses: string[];
  overall_stance?: string | null;
}

interface PersonaData {
  id: string;
  identity: { name: string; avatar: string; locale_variants?: Record<string, { name: string }> };
  demographics: { occupation: string };
}

interface CompareResultViewProps {
  baseReport: ReportData | null;
  baseReviews: ReviewData[];
  basePersonas: PersonaData[];
  baseTitle: string;
  newReport: ReportData | null;
  newReviews: ReviewData[];
  newPersonas: PersonaData[];
  newTitle: string;
  topicClassification: TopicClassification | null;
  mode: "product" | "topic";
  locale: string;
}

function safeArray<T>(val: unknown): T[] {
  return Array.isArray(val) ? val : [];
}

const STANCE_NUMERIC: Record<string, number> = {
  strongly_positive: 5, positive: 4, neutral: 3, negative: 2, strongly_negative: 1,
};

function toNumericValues(scores: Record<string, number | string>): number[] {
  return Object.values(scores)
    .map((v) => (typeof v === "number" ? v : STANCE_NUMERIC[String(v)] ?? null))
    .filter((v): v is number => v != null);
}

function scoreColor(score: number | null): string {
  if (score == null) return "#666462";
  if (score >= 7) return "#4ADE80";
  if (score >= 5) return "#C4A882";
  return "#F87171";
}

function DeltaIndicator({ delta }: { delta: number | null }) {
  if (delta == null) return null;
  const color = delta > 0 ? "#4ADE80" : delta < 0 ? "#F87171" : "#666462";
  const Icon = delta > 0 ? ArrowUp : delta < 0 ? ArrowDown : Minus;
  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-medium tabular-nums" style={{ color }}>
      <Icon className="h-3 w-3" />
      {Math.abs(delta).toFixed(1)}
    </span>
  );
}

export function CompareResultView({
  baseReport,
  baseReviews,
  basePersonas,
  baseTitle,
  newReport,
  newReviews,
  newPersonas,
  newTitle,
  topicClassification,
  mode,
  locale,
}: CompareResultViewProps) {
  const t = useTranslations("evaluation");
  const isTopicMode = mode === "topic";

  const baseScore = isTopicMode ? (baseReport?.consensus_score ?? null) : (baseReport?.overall_score ?? null);
  const newScore = isTopicMode ? (newReport?.consensus_score ?? null) : (newReport?.overall_score ?? null);
  const scoreDelta = baseScore != null && newScore != null ? newScore - baseScore : null;

  const personaMap = new Map<string, PersonaData>();
  for (const p of [...basePersonas, ...newPersonas]) personaMap.set(p.id, p);

  const allDims = new Set<string>();
  for (const d of safeArray<NonNullable<ReportData["multi_dimensional_analysis"]>[number]>(baseReport?.multi_dimensional_analysis)) allDims.add(d.dimension);
  for (const d of safeArray<NonNullable<ReportData["multi_dimensional_analysis"]>[number]>(newReport?.multi_dimensional_analysis)) allDims.add(d.dimension);

  function getDimScore(report: ReportData | null, key: string) {
    const match = report?.multi_dimensional_analysis?.find((d) => d.dimension === key);
    return match;
  }

  function getDimLabel(key: string) {
    const dim = topicClassification?.dimensions.find((d) => d.key === key);
    if (dim) return locale === "zh" ? dim.label_zh : dim.label_en;
    const match = baseReport?.multi_dimensional_analysis?.find((d) => d.dimension === key);
    return (locale === "zh" ? match?.label_zh : match?.label_en) || key;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="mx-auto max-w-5xl px-4 py-10 space-y-8"
    >
      {/* Header */}
      <div className="text-center">
        <Scale className="mx-auto mb-2 h-6 w-6 text-[#C4A882]" />
        <h1 className="text-2xl font-semibold text-[#EAEAE8] tracking-[-0.02em]">
          {locale === "zh" ? "版本对比" : "Version Compare"}
        </h1>
      </div>

      {/* Title row */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        <div className="rounded-xl border border-[#2A2A2A] bg-[#141414] px-5 py-3 text-center">
          <p className="text-[10px] font-semibold uppercase text-[#666462] mb-1">
            {locale === "zh" ? "基线" : "Baseline"}
          </p>
          <p className="text-sm font-medium text-[#9B9594] truncate">{baseTitle}</p>
        </div>
        <ArrowRight className="h-5 w-5 text-[#666462]" />
        <div className="rounded-xl border border-[#C4A882]/20 bg-[#C4A882]/5 px-5 py-3 text-center">
          <p className="text-[10px] font-semibold uppercase text-[#C4A882] mb-1">
            {locale === "zh" ? "新版本" : "New Version"}
          </p>
          <p className="text-sm font-medium text-[#EAEAE8] truncate">{newTitle}</p>
        </div>
      </div>

      {/* Overall score comparison */}
      {baseReport && newReport && (
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          <div className="text-center">
            <div className="text-4xl font-semibold tabular-nums" style={{ color: scoreColor(baseScore) }}>
              {isTopicMode ? `${baseScore ?? 0}%` : (baseScore ?? 0).toFixed(1)}
            </div>
          </div>
          <div className="text-center px-4">
            <DeltaIndicator delta={scoreDelta} />
            <p className="text-[10px] text-[#666462] mt-1">
              {isTopicMode ? (locale === "zh" ? "共识度" : "Consensus") : (locale === "zh" ? "总分" : "Overall")}
            </p>
          </div>
          <div className="text-center">
            <div className="text-4xl font-semibold tabular-nums" style={{ color: scoreColor(newScore) }}>
              {isTopicMode ? `${newScore ?? 0}%` : (newScore ?? 0).toFixed(1)}
            </div>
          </div>
        </div>
      )}

      {/* Dimension comparison */}
      {allDims.size > 0 && (
        <div className="rounded-xl border border-[#2A2A2A] bg-[#141414] p-5">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-[#666462]">
            {t("dimensionAnalysis")}
          </p>
          <div className="space-y-3">
            {Array.from(allDims).map((key) => {
              const baseDim = getDimScore(baseReport, key);
              const newDim = getDimScore(newReport, key);
              const a = baseDim?.score ?? null;
              const b = newDim?.score ?? null;
              const delta = a != null && b != null ? b - a : null;
              return (
                <div key={key} className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                  <div className="text-right">
                    <span className="text-base font-medium tabular-nums" style={{ color: scoreColor(a) }}>
                      {a != null ? a.toFixed(1) : "—"}
                    </span>
                  </div>
                  <div className="text-center min-w-[120px]">
                    <p className="text-xs text-[#9B9594]">{getDimLabel(key)}</p>
                    {delta !== null && (
                      <DeltaIndicator delta={delta} />
                    )}
                  </div>
                  <div className="text-left">
                    <span className="text-base font-medium tabular-nums" style={{ color: scoreColor(b) }}>
                      {b != null ? b.toFixed(1) : "—"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Per-persona comparison */}
      {baseReviews.length > 0 && (
        <div className="rounded-xl border border-[#2A2A2A] bg-[#141414] p-5">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-[#666462]">
            {t("personaAnalysis")}
          </p>
          <div className="space-y-4">
            {baseReviews.map((baseReview) => {
              const persona = personaMap.get(baseReview.persona_id);
              if (!persona) return null;
              const newReview = newReviews.find((r) => r.persona_id === baseReview.persona_id);
              const localized = persona.identity.locale_variants?.[locale] || persona.identity;

              const baseScoreValues = toNumericValues(baseReview.scores);
              const newScoreValues = newReview ? toNumericValues(newReview.scores) : [];
              const baseAvg = baseScoreValues.length > 0 ? baseScoreValues.reduce((a, b) => a + b, 0) / baseScoreValues.length : null;
              const newAvg = newScoreValues.length > 0 ? newScoreValues.reduce((a, b) => a + b, 0) / newScoreValues.length : null;
              const avgDelta = baseAvg != null && newAvg != null ? newAvg - baseAvg : null;

              return (
                <div key={baseReview.persona_id} className="rounded-lg border border-[#2A2A2A] p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <PersonaAvatar avatar={persona.identity.avatar} size={32} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#EAEAE8] truncate">{localized.name}</p>
                      <p className="text-[10px] text-[#666462]">{persona.demographics.occupation}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium tabular-nums" style={{ color: scoreColor(baseAvg) }}>
                        {baseAvg != null ? baseAvg.toFixed(1) : "—"}
                      </span>
                      <DeltaIndicator delta={avgDelta} />
                      <span className="text-sm font-medium tabular-nums" style={{ color: scoreColor(newAvg) }}>
                        {newAvg != null ? newAvg.toFixed(1) : "—"}
                      </span>
                    </div>
                  </div>

                  {newReview && (
                    <div className="grid gap-3 sm:grid-cols-2 text-xs">
                      <div className="rounded-lg bg-[#0C0C0C] p-3">
                        <p className="text-[10px] font-semibold text-[#666462] mb-1 uppercase">
                          {locale === "zh" ? "基线" : "Baseline"}
                        </p>
                        <p className="text-[#9B9594] line-clamp-3">{baseReview.review_text}</p>
                      </div>
                      <div className="rounded-lg bg-[#C4A882]/5 border border-[#C4A882]/10 p-3">
                        <p className="text-[10px] font-semibold text-[#C4A882] mb-1 uppercase">
                          {locale === "zh" ? "新版本" : "New Version"}
                        </p>
                        <p className="text-[#9B9594] line-clamp-3">{newReview.review_text}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Consensus comparison */}
      {safeArray(baseReport?.persona_analysis?.consensus).length > 0 && safeArray(newReport?.persona_analysis?.consensus).length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-[#2A2A2A] bg-[#141414] p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#666462]">
              {locale === "zh" ? "基线 — 共识" : "Baseline — Consensus"}
            </p>
            <ul className="space-y-2">
              {safeArray<{ point: string }>(baseReport?.persona_analysis?.consensus).map((c, i) => (
                <li key={i} className="text-xs text-[#9B9594]">• {c.point}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-[#C4A882]/20 bg-[#C4A882]/5 p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#C4A882]">
              {locale === "zh" ? "新版本 — 共识" : "New Version — Consensus"}
            </p>
            <ul className="space-y-2">
              {safeArray<{ point: string }>(newReport?.persona_analysis?.consensus).map((c, i) => (
                <li key={i} className="text-xs text-[#9B9594]">• {c.point}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Action items comparison */}
      {safeArray(baseReport?.action_items).length > 0 && safeArray(newReport?.action_items).length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-[#2A2A2A] bg-[#141414] p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#666462]">
              {locale === "zh" ? "基线 — 行动项" : "Baseline — Action Items"}
            </p>
            <ul className="space-y-2">
              {safeArray<{ description: string; priority: string }>(baseReport?.action_items).slice(0, 5).map((a, i) => (
                <li key={i} className="text-xs text-[#9B9594] flex items-start gap-2">
                  <Badge variant="secondary" className={`shrink-0 text-[9px] ${a.priority === "critical" ? "bg-[#F87171]/10 text-[#F87171]" : "bg-[#1C1C1C] text-[#666462]"}`}>
                    {a.priority}
                  </Badge>
                  <span>{a.description}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-[#C4A882]/20 bg-[#C4A882]/5 p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#C4A882]">
              {locale === "zh" ? "新版本 — 行动项" : "New Version — Action Items"}
            </p>
            <ul className="space-y-2">
              {safeArray<{ description: string; priority: string }>(newReport?.action_items).slice(0, 5).map((a, i) => (
                <li key={i} className="text-xs text-[#9B9594] flex items-start gap-2">
                  <Badge variant="secondary" className={`shrink-0 text-[9px] ${a.priority === "critical" ? "bg-[#F87171]/10 text-[#F87171]" : "bg-[#1C1C1C] text-[#666462]"}`}>
                    {a.priority}
                  </Badge>
                  <span>{a.description}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </motion.div>
  );
}
