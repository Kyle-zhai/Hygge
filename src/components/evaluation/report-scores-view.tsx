"use client";

import { useRef, useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { ArrowLeft, TrendingUp, TrendingDown, Users, BarChart3, Target, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const readinessColors: Record<string, string> = {
  low: "bg-[#F87171]/10 text-[#F87171]",
  medium: "bg-[#FBBF24]/10 text-[#FBBF24]",
  high: "bg-[#4ADE80]/10 text-[#4ADE80]",
};

const priorityColors: Record<string, string> = {
  critical: "bg-[#F87171]/10 text-[#F87171] border-[#F87171]/20",
  high: "bg-[#F97316]/10 text-[#F97316] border-[#F97316]/20",
  medium: "bg-[#FBBF24]/10 text-[#FBBF24] border-[#FBBF24]/20",
  low: "bg-[#1C1C1C] text-[#9B9594] border-[#2A2A2A]",
};

interface PersonaData {
  id: string;
  identity: any;
  demographics: any;
  category: string;
}

interface ReviewData {
  id: string;
  persona_id: string;
  scores: Record<string, number | string>;
  review_text: string;
  strengths: string[];
  weaknesses: string[];
  overall_stance?: string | null;
}

interface TopicClassification {
  topic_type: string;
  dimensions: Array<{ key: string; label_en: string; label_zh: string; description: string }>;
  readiness_label_en: string;
  readiness_label_zh: string;
}

interface ReportData {
  overall_score: number;
  market_readiness: string;
  readiness_label_en?: string;
  readiness_label_zh?: string;
  persona_analysis: {
    entries?: Array<{
      persona_id: string;
      core_viewpoint: string;
      scoring_rationale: string;
    }>;
    consensus: Array<{ point: string; supporting_personas?: string[] }>;
    disagreements: Array<{ point: string; reason: string }>;
  };
  multi_dimensional_analysis: Array<{
    dimension: string;
    label_en?: string;
    label_zh?: string;
    score?: number;
    analysis: string;
    strengths?: string[];
    weaknesses?: string[];
    overall_leaning?: string;
    positive_count?: number;
    negative_count?: number;
    neutral_count?: number;
    support_count?: number;
    oppose_count?: number;
    key_arguments?: { positive?: string; negative?: string; for?: string; against?: string };
  }>;
  goal_assessment: Array<{
    goal: string;
    achievable: boolean;
    current_status: string;
    gaps?: string[];
  }>;
  if_not_feasible: {
    direction: string;
    modifications?: string[];
    reference_cases?: string[];
  };
  if_feasible: {
    next_steps?: string[];
    risks?: string[];
  };
  action_items: Array<{
    description: string;
    priority: string;
    expected_impact: string;
    difficulty: string;
  }>;
  scenario_simulation?: {
    summary: string;
    adoption_rate_shift: number;
    influence_events?: Array<{
      influencer_id: string;
      influenced_id: string;
      shift: string;
    }>;
  };
  consensus_score?: number | null;
  positions?: {
    question: string;
    positive_label: string;
    positive_summary: string;
    negative_label: string;
    negative_summary: string;
  } | null;
  references?: Array<{
    title: string;
    detail: string;
    source?: string;
    persona_name?: string;
  }> | null;
}

interface ReportScoresViewProps {
  report: ReportData | null;
  reviews: ReviewData[];
  personas: PersonaData[];
  locale: string;
  onBack?: () => void;
  topicClassification?: TopicClassification | null;
  mode?: "topic" | "product";
}

// ── Utility Functions ──

const FIXED_DIMENSIONS = ["usability", "market_fit", "design", "tech_quality", "innovation", "pricing"] as const;

const stanceToNum: Record<string, number> = {
  strongly_negative: 1, strongly_oppose: 1,
  negative: 2, oppose: 2,
  neutral: 3,
  positive: 4, support: 4,
  strongly_positive: 5, strongly_support: 5,
};

const stanceSymbol: Record<string, string> = {
  strongly_positive: "▲▲", strongly_support: "▲▲",
  positive: "▲", support: "▲",
  neutral: "●",
  negative: "▼", oppose: "▼",
  strongly_negative: "▼▼", strongly_oppose: "▼▼",
};

const stanceColorMap: Record<string, string> = {
  strongly_positive: "#34D399", strongly_support: "#34D399",
  positive: "#4ADE80", support: "#4ADE80",
  neutral: "#FBBF24",
  negative: "#F97316", oppose: "#F97316",
  strongly_negative: "#F87171", strongly_oppose: "#F87171",
};

function safeArray<T>(val: unknown): T[] {
  if (Array.isArray(val)) return val;
  if (typeof val === "string" && val.trim()) return [val as unknown as T];
  return [];
}

function safeTr(t: ReturnType<typeof useTranslations>, key: string | undefined | null, fallback?: string): string {
  if (!key) return fallback ?? "";
  try { return t(key as any); } catch { return fallback ?? key; }
}

function safeScoresOf(scores: unknown): Record<string, number | string> {
  return (scores && typeof scores === "object" && !Array.isArray(scores)) ? scores as Record<string, number | string> : {};
}

function heatmapBg(score: number): string {
  if (score >= 8) return "rgba(74, 222, 128, 0.12)";
  if (score >= 6) return "rgba(251, 191, 36, 0.08)";
  if (score >= 4) return "rgba(249, 115, 22, 0.08)";
  if (score > 0) return "rgba(248, 113, 113, 0.08)";
  return "transparent";
}

function scoreColor(score: number): string {
  if (score >= 8) return "#4ADE80";
  if (score >= 6) return "#FBBF24";
  if (score >= 4) return "#F97316";
  if (score > 0) return "#F87171";
  return "#666462";
}

function scoreGradient(score: number): string {
  if (score >= 8) return "linear-gradient(90deg, #4ADE80, #34D399)";
  if (score >= 6) return "linear-gradient(90deg, #FBBF24, #F59E0B)";
  if (score >= 4) return "linear-gradient(90deg, #FBBF24, #F97316)";
  return "linear-gradient(90deg, #F87171, #EF4444)";
}

// ── Component ──

export function ReportScoresView({ report, reviews, personas, locale, onBack, topicClassification, mode = "product" }: ReportScoresViewProps) {
  const isTopicMode = mode === "topic";
  const t = useTranslations("evaluation");
  const topRef = useRef<HTMLDivElement>(null);
  const personaMap = new Map(personas.map((p) => [p.id, p]));

  useEffect(() => {
    window.scrollTo(0, 0);
    topRef.current?.scrollIntoView();
  }, []);

  const dimKeys = topicClassification?.dimensions
    ? topicClassification.dimensions.map(d => d.key)
    : (FIXED_DIMENSIONS as unknown as string[]);

  const dimLabelMap = topicClassification?.dimensions
    ? new Map(topicClassification.dimensions.map(d => [d.key, locale === "zh" ? d.label_zh : d.label_en]))
    : null;

  function dimLabel(key: string): string {
    if (dimLabelMap) return dimLabelMap.get(key) ?? key;
    return safeTr(t, key, key);
  }

  const maxScale = isTopicMode ? 5 : 10;

  // ── Per-persona computed data ──
  const personaRankings = useMemo(() => {
    return reviews.map(review => {
      const persona = personaMap.get(review.persona_id);
      const localized = persona?.identity?.locale_variants?.[locale] || persona?.identity;
      const safe = safeScoresOf(review.scores);

      const entries = dimKeys.map(dim => {
        const raw = safe[dim];
        const value = isTopicMode ? (stanceToNum[String(raw)] || 3) : (Number(raw) || 0);
        return { dim, value, raw: String(raw ?? "") };
      });
      const validEntries = entries.filter(e => e.value > 0);
      const avg = validEntries.length ? validEntries.reduce((a, e) => a + e.value, 0) / validEntries.length : 0;
      const best = validEntries.length ? validEntries.reduce((a, b) => a.value > b.value ? a : b) : null;
      const worst = validEntries.length ? validEntries.reduce((a, b) => a.value < b.value ? a : b) : null;

      return {
        id: review.persona_id,
        name: localized?.name || "Unknown",
        avatar: persona?.identity?.avatar || "?",
        avg,
        best,
        worst,
        scores: safe,
        entries,
      };
    }).sort((a, b) => b.avg - a.avg);
  }, [reviews, personas, dimKeys, locale, isTopicMode]);

  // ── Per-dimension stats ──
  const dimensionStats = useMemo(() => {
    return dimKeys.map(dim => {
      const values = reviews.map(r => {
        const s = safeScoresOf(r.scores);
        return isTopicMode ? (stanceToNum[String(s[dim])] || 0) : (Number(s[dim]) || 0);
      }).filter(v => v > 0);
      const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
      const min = values.length ? Math.min(...values) : 0;
      const max = values.length ? Math.max(...values) : 0;
      const spread = max - min;
      const analysis = safeArray<any>(report?.multi_dimensional_analysis)
        .filter((d: any) => typeof d === "object" && d !== null)
        .find((d: any) => d.dimension === dim);
      return { dim, avg, min, max, spread, count: values.length, analysis };
    });
  }, [reviews, dimKeys, report, isTopicMode]);

  const dimStatsSorted = useMemo(() => [...dimensionStats].sort((a, b) => b.avg - a.avg), [dimensionStats]);
  const dimByDivergence = useMemo(() => [...dimensionStats].sort((a, b) => b.spread - a.spread), [dimensionStats]);

  // ── Overall stats ──
  const globalStats = useMemo(() => {
    const allValues = reviews.flatMap(r => {
      const s = safeScoresOf(r.scores);
      if (isTopicMode) return Object.values(s).map(v => stanceToNum[String(v)] || 0).filter(n => n > 0);
      return Object.values(s).map(Number).filter(n => !isNaN(n) && n > 0);
    });
    const avg = allValues.length ? allValues.reduce((a, b) => a + b, 0) / allValues.length : 0;
    const min = allValues.length ? Math.min(...allValues) : 0;
    const max = allValues.length ? Math.max(...allValues) : 0;
    return { avg, min, max };
  }, [reviews, isTopicMode]);

  const displayScore = report?.overall_score ?? Number(globalStats.avg.toFixed(1));
  const topDim = dimStatsSorted[0];
  const weakDim = dimStatsSorted[dimStatsSorted.length - 1];

  return (
    <motion.div
      ref={topRef}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-8"
    >
      {/* Back button */}
      {onBack && (
        <Button
          variant="ghost"
          onClick={onBack}
          className="text-[#9B9594] hover:text-[#EAEAE8] hover:bg-[#1C1C1C] -ml-2"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {locale === "zh" ? "返回文字报告" : "Back to Report"}
        </Button>
      )}

      {/* ═══ Stats Overview ═══ */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-xl border border-[#2A2A2A] bg-[#141414] p-4 text-center"
        >
          <div className="text-3xl font-bold" style={{ color: isTopicMode ? "#EAEAE8" : scoreColor(displayScore) }}>
            {isTopicMode ? `${report?.consensus_score ?? 0}%` : displayScore}
          </div>
          <p className="mt-1 text-xs text-[#666462]">
            {isTopicMode ? (locale === "zh" ? "共识度" : "Consensus") : (locale === "zh" ? "综合评分" : "Overall Score")}
          </p>
          {report && (
            <Badge className={`mt-2 text-[10px] ${readinessColors[report.market_readiness] || ""}`}>
              {safeTr(t, report.market_readiness, report.market_readiness || "N/A")}
            </Badge>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl border border-[#2A2A2A] bg-[#141414] p-4 text-center"
        >
          <div className="flex items-center justify-center gap-1.5">
            <Users className="h-5 w-5 text-[#9B9594]" />
            <span className="text-3xl font-bold text-[#EAEAE8]">{reviews.length}</span>
          </div>
          <p className="mt-1 text-xs text-[#666462]">
            {locale === "zh" ? "评估者" : "Personas"}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-xl border border-[#2A2A2A] bg-[#141414] p-4 text-center"
        >
          <div className="flex items-center justify-center gap-1">
            <TrendingUp className="h-4 w-4 text-[#4ADE80]" />
            <span className="text-lg font-bold text-[#4ADE80]">{topDim?.avg.toFixed(1) ?? "-"}</span>
          </div>
          <p className="mt-1 text-xs text-[#666462] truncate" title={topDim ? dimLabel(topDim.dim) : ""}>
            {topDim ? dimLabel(topDim.dim) : "-"}
          </p>
          <p className="text-[10px] text-[#555]">{locale === "zh" ? "最强维度" : "Top Dimension"}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-xl border border-[#2A2A2A] bg-[#141414] p-4 text-center"
        >
          <div className="flex items-center justify-center gap-1">
            <TrendingDown className="h-4 w-4 text-[#F97316]" />
            <span className="text-lg font-bold text-[#F97316]">{weakDim?.avg.toFixed(1) ?? "-"}</span>
          </div>
          <p className="mt-1 text-xs text-[#666462] truncate" title={weakDim ? dimLabel(weakDim.dim) : ""}>
            {weakDim ? dimLabel(weakDim.dim) : "-"}
          </p>
          <p className="text-[10px] text-[#555]">{locale === "zh" ? "最弱维度" : "Needs Attention"}</p>
        </motion.div>
      </div>

      {/* ═══ Score Heatmap Matrix ═══ */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-[#9B9594]" />
          <h2 className="text-lg font-semibold text-[#EAEAE8]">
            {locale === "zh" ? "评分矩阵" : "Score Matrix"}
          </h2>
        </div>
        <div className="overflow-x-auto rounded-xl border border-[#2A2A2A] bg-[#0C0C0C]">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b border-[#2A2A2A]">
                <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-[#555]">
                  {locale === "zh" ? "评估者" : "Persona"}
                </th>
                {dimKeys.map(dim => (
                  <th key={dim} className="px-2 py-3 text-center text-[11px] font-medium uppercase tracking-wider text-[#555]">
                    {dimLabel(dim)}
                  </th>
                ))}
                <th className="px-3 py-3 text-center text-[11px] font-medium uppercase tracking-wider text-[#9B9594]">
                  {locale === "zh" ? "均分" : "AVG"}
                </th>
              </tr>
            </thead>
            <tbody>
              {personaRankings.map((p, idx) => (
                <motion.tr
                  key={p.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 * idx }}
                  className={idx < personaRankings.length - 1 ? "border-b border-[#1A1A1A]" : ""}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{p.avatar}</span>
                      <span className="text-sm font-medium text-[#EAEAE8] truncate max-w-[120px]">{p.name}</span>
                    </div>
                  </td>
                  {p.entries.map(entry => {
                    const normalized = isTopicMode ? entry.value * 2 : entry.value;
                    return (
                      <td
                        key={entry.dim}
                        className="px-2 py-3 text-center"
                        style={{ backgroundColor: heatmapBg(normalized) }}
                      >
                        {isTopicMode ? (
                          <span className="text-sm font-semibold" style={{ color: stanceColorMap[entry.raw] || "#FBBF24" }}>
                            {stanceSymbol[entry.raw] || "●"}
                          </span>
                        ) : (
                          <span className="text-sm font-semibold" style={{ color: scoreColor(entry.value) }}>
                            {entry.value || "-"}
                          </span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-3 py-3 text-center">
                    <span className="text-sm font-bold" style={{ color: scoreColor(isTopicMode ? p.avg * 2 : p.avg) }}>
                      {p.avg.toFixed(1)}
                    </span>
                  </td>
                </motion.tr>
              ))}
              {/* Average row */}
              <tr className="border-t-2 border-[#2A2A2A] bg-[#111]">
                <td className="px-4 py-3 text-sm font-semibold text-[#9B9594]">
                  {locale === "zh" ? "平均值" : "Average"}
                </td>
                {dimensionStats.map(stat => {
                  const normalized = isTopicMode ? stat.avg * 2 : stat.avg;
                  return (
                    <td key={stat.dim} className="px-2 py-3 text-center">
                      <span className="text-sm font-bold" style={{ color: scoreColor(normalized) }}>
                        {stat.avg.toFixed(1)}
                      </span>
                    </td>
                  );
                })}
                <td className="px-3 py-3 text-center">
                  <span className="text-sm font-bold text-[#EAEAE8]">{globalStats.avg.toFixed(1)}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        {isTopicMode && (
          <div className="flex items-center justify-center gap-4 text-[10px] text-[#555]">
            <span><span className="text-[#34D399]">▲▲</span> {locale === "zh" ? "强烈正面" : "Strongly Positive"}</span>
            <span><span className="text-[#4ADE80]">▲</span> {locale === "zh" ? "正面" : "Positive"}</span>
            <span><span className="text-[#FBBF24]">●</span> {locale === "zh" ? "中立" : "Neutral"}</span>
            <span><span className="text-[#F97316]">▼</span> {locale === "zh" ? "负面" : "Negative"}</span>
            <span><span className="text-[#F87171]">▼▼</span> {locale === "zh" ? "强烈负面" : "Strongly Negative"}</span>
          </div>
        )}
      </section>

      {/* ═══ Dimension Rankings ═══ */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-[#9B9594]" />
          <h2 className="text-lg font-semibold text-[#EAEAE8]">
            {locale === "zh" ? "维度排名" : "Dimension Rankings"}
          </h2>
        </div>
        <div className="space-y-4">
          {dimStatsSorted.map((stat, i) => {
            const pct = (stat.avg / maxScale) * 100;
            const minPct = (stat.min / maxScale) * 100;
            const maxPct = (stat.max / maxScale) * 100;
            const normalized = isTopicMode ? stat.avg * 2 : stat.avg;
            return (
              <motion.div
                key={stat.dim}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.06 * i }}
                className="rounded-lg border border-[#2A2A2A] bg-[#141414] p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#555] w-5">#{i + 1}</span>
                    <span className="text-sm font-medium text-[#EAEAE8]">{dimLabel(stat.dim)}</span>
                  </div>
                  <span className="text-lg font-bold" style={{ color: scoreColor(normalized) }}>
                    {stat.avg.toFixed(1)}
                    <span className="text-[10px] text-[#555] ml-0.5">/{maxScale}</span>
                  </span>
                </div>
                {/* Bar with range */}
                <div className="relative h-2 rounded-full bg-[#1C1C1C] overflow-hidden">
                  {stat.count > 1 && (
                    <div
                      className="absolute h-full bg-[#222] rounded-full"
                      style={{ left: `${minPct}%`, width: `${maxPct - minPct}%` }}
                    />
                  )}
                  <motion.div
                    className="absolute h-full rounded-full"
                    style={{ background: scoreGradient(normalized) }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.6, delay: 0.08 * i }}
                  />
                </div>
                <div className="flex items-center justify-between mt-1.5 text-[10px] text-[#555]">
                  <span>{locale === "zh" ? "最低" : "Min"}: {stat.min}</span>
                  <span>{locale === "zh" ? "分差" : "Spread"}: {stat.spread.toFixed(1)}</span>
                  <span>{locale === "zh" ? "最高" : "Max"}: {stat.max}</span>
                </div>
                {/* Analysis snippet from report */}
                {stat.analysis?.analysis && (
                  <p className="mt-2 text-xs text-[#666462] leading-relaxed line-clamp-2">{stat.analysis.analysis}</p>
                )}
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ═══ Persona Rankings ═══ */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-[#9B9594]" />
          <h2 className="text-lg font-semibold text-[#EAEAE8]">
            {locale === "zh" ? "评估者排名" : "Persona Rankings"}
          </h2>
        </div>
        <div className="space-y-2">
          {personaRankings.map((p, rank) => {
            const normalized = isTopicMode ? p.avg * 2 : p.avg;
            const barPct = (p.avg / maxScale) * 100;
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.06 * rank }}
                className="flex items-center gap-3 rounded-lg border border-[#2A2A2A] bg-[#141414] p-3"
              >
                <span className="text-xl font-bold text-[#2A2A2A] w-8 text-center shrink-0">
                  {rank + 1}
                </span>
                <span className="text-xl shrink-0">{p.avatar}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-[#EAEAE8] truncate">{p.name}</span>
                    <span className="text-sm font-bold shrink-0" style={{ color: scoreColor(normalized) }}>
                      {p.avg.toFixed(1)}
                    </span>
                  </div>
                  {/* Mini bar */}
                  <div className="h-1 rounded-full bg-[#1C1C1C] overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: scoreGradient(normalized) }}
                      initial={{ width: 0 }}
                      animate={{ width: `${barPct}%` }}
                      transition={{ duration: 0.5, delay: 0.08 * rank }}
                    />
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-[#555]">
                    {p.best && (
                      <span>
                        <TrendingUp className="inline h-3 w-3 text-[#4ADE80] mr-0.5" />
                        {dimLabel(p.best.dim)} ({p.best.value})
                      </span>
                    )}
                    {p.worst && (
                      <span>
                        <TrendingDown className="inline h-3 w-3 text-[#F97316] mr-0.5" />
                        {dimLabel(p.worst.dim)} ({p.worst.value})
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ═══ Divergence Analysis ═══ */}
      {reviews.length > 1 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-[#9B9594]" />
            <h2 className="text-lg font-semibold text-[#EAEAE8]">
              {locale === "zh" ? "共识与分歧" : "Consensus vs. Divergence"}
            </h2>
          </div>
          <p className="text-xs text-[#555]">
            {locale === "zh"
              ? "分差越小代表评估者意见越一致，分差越大代表分歧越大"
              : "Lower spread = more agreement among personas. Higher spread = more divergence."}
          </p>
          <div className="space-y-2">
            {dimByDivergence.map((stat, i) => {
              const spreadPct = (stat.spread / maxScale) * 100;
              const isAgreement = stat.spread <= (maxScale * 0.15);
              const isDivergent = stat.spread >= (maxScale * 0.4);
              return (
                <motion.div
                  key={stat.dim}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.04 * i }}
                  className="flex items-center gap-3 rounded-lg bg-[#141414] border border-[#2A2A2A] px-4 py-2.5"
                >
                  <span className="w-24 text-xs text-[#9B9594] truncate shrink-0">{dimLabel(stat.dim)}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-[#1C1C1C] overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{
                        background: isDivergent
                          ? "linear-gradient(90deg, #F87171, #F97316)"
                          : isAgreement
                          ? "linear-gradient(90deg, #4ADE80, #34D399)"
                          : "linear-gradient(90deg, #FBBF24, #F59E0B)",
                        width: `${Math.max(spreadPct, 4)}%`,
                      }}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max(spreadPct, 4)}%` }}
                      transition={{ duration: 0.5, delay: 0.04 * i }}
                    />
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-semibold" style={{
                      color: isDivergent ? "#F87171" : isAgreement ? "#4ADE80" : "#FBBF24"
                    }}>
                      {stat.spread.toFixed(1)}
                    </span>
                    <Badge className={`text-[9px] px-1.5 py-0 ${
                      isDivergent
                        ? "bg-[#F87171]/10 text-[#F87171]"
                        : isAgreement
                        ? "bg-[#4ADE80]/10 text-[#4ADE80]"
                        : "bg-[#FBBF24]/10 text-[#FBBF24]"
                    }`}>
                      {isDivergent
                        ? (locale === "zh" ? "分歧" : "Divergent")
                        : isAgreement
                        ? (locale === "zh" ? "共识" : "Agreement")
                        : (locale === "zh" ? "一般" : "Moderate")}
                    </Badge>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>
      )}

      {/* ═══ Goal Assessment (product mode only, compact table) ═══ */}
      {!isTopicMode && report && safeArray(report.goal_assessment).length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-[#9B9594]" />
            <h2 className="text-lg font-semibold text-[#EAEAE8]">{t("goalAssessment")}</h2>
          </div>
          <div className="overflow-x-auto rounded-xl border border-[#2A2A2A] bg-[#0C0C0C]">
            <table className="w-full min-w-[500px]">
              <thead>
                <tr className="border-b border-[#2A2A2A]">
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-[#555]">
                    {locale === "zh" ? "目标" : "Goal"}
                  </th>
                  <th className="px-3 py-2.5 text-center text-[11px] font-medium uppercase tracking-wider text-[#555]">
                    {locale === "zh" ? "可行性" : "Status"}
                  </th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-[#555]">
                    {locale === "zh" ? "当前状态" : "Assessment"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {safeArray<ReportData["goal_assessment"][number]>(report.goal_assessment).map((goal, i) => (
                  <tr key={i} className={i < safeArray(report.goal_assessment).length - 1 ? "border-b border-[#1A1A1A]" : ""}>
                    <td className="px-4 py-3 text-sm text-[#EAEAE8]">{goal.goal}</td>
                    <td className="px-3 py-3 text-center">
                      <Badge className={`text-[10px] ${goal.achievable ? "bg-[#4ADE80]/10 text-[#4ADE80]" : "bg-[#F87171]/10 text-[#F87171]"}`}>
                        {goal.achievable ? t("achievable") : t("notAchievable")}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#9B9594]">{goal.current_status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ═══ Action Priority Matrix (product mode only) ═══ */}
      {!isTopicMode && report && safeArray(report.action_items).length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-[#9B9594]" />
            <h2 className="text-lg font-semibold text-[#EAEAE8]">{t("actionItems")}</h2>
          </div>
          <div className="overflow-x-auto rounded-xl border border-[#2A2A2A] bg-[#0C0C0C]">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-[#2A2A2A]">
                  <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-[#555]">
                    {locale === "zh" ? "行动项" : "Action"}
                  </th>
                  <th className="px-3 py-2.5 text-center text-[11px] font-medium uppercase tracking-wider text-[#555]">
                    {t("priority")}
                  </th>
                  <th className="px-3 py-2.5 text-center text-[11px] font-medium uppercase tracking-wider text-[#555]">
                    {t("impact")}
                  </th>
                  <th className="px-3 py-2.5 text-center text-[11px] font-medium uppercase tracking-wider text-[#555]">
                    {t("difficulty")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {safeArray<ReportData["action_items"][number]>(report.action_items).map((item, i) => (
                  <tr key={i} className={i < safeArray(report.action_items).length - 1 ? "border-b border-[#1A1A1A]" : ""}>
                    <td className="px-4 py-3 text-sm text-[#EAEAE8] max-w-[300px]">{item.description}</td>
                    <td className="px-3 py-3 text-center">
                      <Badge className={`text-[10px] border ${priorityColors[item.priority] || priorityColors.medium}`}>
                        {safeTr(t, item.priority, item.priority || "medium")}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-center text-xs text-[#9B9594]">{item.expected_impact}</td>
                    <td className="px-3 py-3 text-center">
                      <span className="text-xs text-[#666462]">{safeTr(t, item.difficulty, item.difficulty || "medium")}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </motion.div>
  );
}
