"use client";

import { useTranslations } from "next-intl";
import { motion } from "framer-motion";

interface TopicDimension {
  key: string;
  label_en: string;
  label_zh: string;
  description: string;
}

interface ScoreBarProps {
  scores: Record<string, number | string>;
  compact?: boolean;
  topicDimensions?: TopicDimension[];
  locale?: string;
  stanceMode?: boolean;
}

const FIXED_DIMENSIONS = ["usability", "market_fit", "design", "tech_quality", "innovation", "pricing"] as const;

function scoreGradient(score: number): string {
  if (score >= 8) return "linear-gradient(90deg, #4ADE80, #34D399)";
  if (score >= 6) return "linear-gradient(90deg, #FBBF24, #F59E0B)";
  if (score >= 4) return "linear-gradient(90deg, #FBBF24, #F97316)";
  return "linear-gradient(90deg, #F87171, #EF4444)";
}

function scoreTextColor(score: number): string {
  if (score >= 8) return "text-[#4ADE80]";
  if (score >= 6) return "text-[#FBBF24]";
  if (score >= 4) return "text-[#FBBF24]";
  return "text-[#F87171]";
}

const STANCE_ORDER = ["strongly_negative", "negative", "neutral", "positive", "strongly_positive"] as const;

const stanceConfig: Record<string, { position: number; color: string; label: string; labelZh: string }> = {
  strongly_negative: { position: 5, color: "#F87171", label: "Strongly Negative", labelZh: "强烈负面" },
  negative: { position: 25, color: "#F97316", label: "Negative", labelZh: "负面" },
  neutral: { position: 50, color: "#FBBF24", label: "Neutral", labelZh: "中立" },
  positive: { position: 75, color: "#4ADE80", label: "Positive", labelZh: "正面" },
  strongly_positive: { position: 95, color: "#34D399", label: "Strongly Positive", labelZh: "强烈正面" },
  // Legacy compat
  strongly_oppose: { position: 5, color: "#F87171", label: "Strongly Negative", labelZh: "强烈负面" },
  oppose: { position: 25, color: "#F97316", label: "Negative", labelZh: "负面" },
  support: { position: 75, color: "#4ADE80", label: "Positive", labelZh: "正面" },
  strongly_support: { position: 95, color: "#34D399", label: "Strongly Positive", labelZh: "强烈正面" },
};

function safeTr(t: ReturnType<typeof useTranslations>, key: string | undefined | null, fallback?: string): string {
  if (!key) return fallback ?? "";
  try { return t(key as any); } catch { return fallback ?? key; }
}

export function ScoreBar({ scores, compact, topicDimensions, locale, stanceMode }: ScoreBarProps) {
  const t = useTranslations("evaluation");
  const safeScores = (scores && typeof scores === "object" && !Array.isArray(scores)) ? scores : {};

  const dimKeys = topicDimensions
    ? topicDimensions.map(d => d.key)
    : FIXED_DIMENSIONS as unknown as string[];

  const dimLabelMap = topicDimensions
    ? new Map(topicDimensions.map(d => [d.key, locale === "zh" ? d.label_zh : d.label_en]))
    : null;

  // Stance mode: show spectrum indicator
  if (stanceMode) {
    return (
      <div className={compact ? "space-y-2.5" : "space-y-3.5"}>
        {dimKeys.map((dim, i) => {
          const stance = String(safeScores[dim] ?? "neutral");
          const config = stanceConfig[stance] || stanceConfig.neutral;

          return (
            <div key={dim}>
              <div className="flex items-center justify-between mb-1">
                <span className={`${compact ? "text-[11px]" : "text-xs"} text-[#666462]`}>
                  {dimLabelMap ? dimLabelMap.get(dim) ?? dim : safeTr(t, dim, dim)}
                </span>
                <span className="text-[10px] font-medium" style={{ color: config.color }}>
                  {locale === "zh" ? config.labelZh : config.label}
                </span>
              </div>
              <div className="relative h-1.5 rounded-full bg-gradient-to-r from-[#F87171]/20 via-[#FBBF24]/20 to-[#4ADE80]/20">
                <motion.div
                  className="absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full border-2 border-[#0C0C0C]"
                  style={{ backgroundColor: config.color }}
                  initial={{ left: "50%" }}
                  animate={{ left: `${config.position}%` }}
                  transition={{ duration: 0.5, delay: i * 0.06, ease: "easeOut" }}
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Score mode: original bar chart
  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      {dimKeys.map((dim, i) => {
        const score = Number(safeScores[dim]) || 0;
        return (
          <div key={dim} className="flex items-center gap-2">
            <span className={`${compact ? "w-16 text-[11px]" : "w-24 text-xs"} text-[#666462] truncate`}>
              {dimLabelMap ? dimLabelMap.get(dim) ?? dim : safeTr(t, dim, dim)}
            </span>
            <div className="h-1.5 flex-1 rounded-full bg-[#1C1C1C]">
              <motion.div
                className="h-full rounded-full"
                style={{ background: scoreGradient(score) }}
                initial={{ width: 0 }}
                animate={{ width: `${score * 10}%` }}
                transition={{ duration: 0.6, delay: i * 0.08, ease: "easeOut" }}
              />
            </div>
            <span className={`${compact ? "w-5 text-[11px]" : "w-6 text-xs"} text-right font-medium ${scoreTextColor(score)}`}>
              {score}
            </span>
          </div>
        );
      })}
    </div>
  );
}
