"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScoreBar } from "./score-radar";
import { ChevronDown, ChevronUp } from "lucide-react";

interface TopicDimension {
  key: string;
  label_en: string;
  label_zh: string;
  description: string;
}

interface PersonaReviewCardProps {
  personaName: string;
  personaAvatar: string;
  personaOccupation: string;
  scores: Record<string, number | string>;
  reviewText: string;
  strengths: string[];
  weaknesses: string[];
  topicDimensions?: TopicDimension[];
  locale?: string;
  stanceMode?: boolean;
  overallStance?: string | null;
}

const stanceBadgeConfig: Record<string, { color: string; label: string; labelZh: string }> = {
  strongly_positive: { color: "border-[#34D399]/30 bg-[#34D399]/10 text-[#34D399]", label: "Strongly Positive", labelZh: "强烈正面" },
  positive: { color: "border-[#4ADE80]/30 bg-[#4ADE80]/10 text-[#4ADE80]", label: "Positive", labelZh: "正面" },
  neutral: { color: "border-[#FBBF24]/30 bg-[#FBBF24]/10 text-[#FBBF24]", label: "Neutral", labelZh: "中立" },
  negative: { color: "border-[#F97316]/30 bg-[#F97316]/10 text-[#F97316]", label: "Negative", labelZh: "负面" },
  strongly_negative: { color: "border-[#F87171]/30 bg-[#F87171]/10 text-[#F87171]", label: "Strongly Negative", labelZh: "强烈负面" },
  // Legacy compat
  strongly_support: { color: "border-[#34D399]/30 bg-[#34D399]/10 text-[#34D399]", label: "Strongly Positive", labelZh: "强烈正面" },
  support: { color: "border-[#4ADE80]/30 bg-[#4ADE80]/10 text-[#4ADE80]", label: "Positive", labelZh: "正面" },
  oppose: { color: "border-[#F97316]/30 bg-[#F97316]/10 text-[#F97316]", label: "Negative", labelZh: "负面" },
  strongly_oppose: { color: "border-[#F87171]/30 bg-[#F87171]/10 text-[#F87171]", label: "Strongly Negative", labelZh: "强烈负面" },
};

function getOverallStance(scores: Record<string, number | string>): string {
  const values = Object.values(scores).map(String);
  const order = ["strongly_negative", "negative", "neutral", "positive", "strongly_positive"];
  const legacyMap: Record<string, string> = {
    strongly_support: "strongly_positive", support: "positive", oppose: "negative", strongly_oppose: "strongly_negative",
  };
  const mapped = values.map(v => legacyMap[v] ?? v);
  const numericValues = mapped.map(v => order.indexOf(v)).filter(v => v >= 0);
  if (numericValues.length === 0) return "neutral";
  const avg = numericValues.reduce((a, b) => a + b, 0) / numericValues.length;
  return order[Math.round(avg)];
}

export function PersonaReviewCard({
  personaName,
  personaAvatar,
  personaOccupation,
  scores,
  reviewText,
  strengths,
  weaknesses,
  topicDimensions,
  locale,
  stanceMode,
  overallStance,
}: PersonaReviewCardProps) {
  const t = useTranslations("evaluation");
  const [expanded, setExpanded] = useState(false);

  let headerBadge: { className: string; label: string };
  if (stanceMode) {
    const overall = overallStance || getOverallStance(scores);
    const cfg = stanceBadgeConfig[overall] || stanceBadgeConfig.neutral;
    headerBadge = { className: `border ${cfg.color}`, label: locale === "zh" ? cfg.labelZh : cfg.label };
  } else {
    const scoreValues = Object.values(scores).map(Number);
    const avgScore = scoreValues.length > 0 ? scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length : 0;
    const scoreBadgeColor =
      avgScore >= 7
        ? "border-[#4ADE80]/30 bg-[#4ADE80]/10 text-[#4ADE80]"
        : avgScore >= 5
        ? "border-[#FBBF24]/30 bg-[#FBBF24]/10 text-[#FBBF24]"
        : "border-[#F87171]/30 bg-[#F87171]/10 text-[#F87171]";
    headerBadge = { className: `border ${scoreBadgeColor}`, label: avgScore.toFixed(1) };
  }

  return (
    <Card className="card-glow border-[#2A2A2A] bg-[#141414] transition-all duration-300 hover:border-[#3A3A3A]">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1C1C1C] text-lg">
            {personaAvatar}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[#EAEAE8]">{personaName}</span>
              <Badge variant="secondary" className={`text-xs font-medium ${headerBadge.className}`}>
                {headerBadge.label}
              </Badge>
            </div>
            <p className="text-xs text-[#666462]">{personaOccupation}</p>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="rounded-lg p-1 text-[#666462] transition-colors hover:bg-[#1C1C1C] hover:text-[#EAEAE8]"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <ScoreBar scores={scores} compact topicDimensions={topicDimensions} locale={locale} stanceMode={stanceMode} />

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-4 overflow-hidden pt-2"
            >
              <p className="text-sm leading-relaxed text-[#9B9594]">{reviewText}</p>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-[#4ADE80]/20 bg-[#4ADE80]/5 p-3">
                  <h4 className="mb-2 text-xs font-semibold text-[#4ADE80]">{t("strengths")}</h4>
                  <ul className="space-y-1">
                    {(Array.isArray(strengths) ? strengths : []).map((s, i) => (
                      <li key={i} className="text-xs text-[#9B9594]">+ {s}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-lg border border-[#F87171]/20 bg-[#F87171]/5 p-3">
                  <h4 className="mb-2 text-xs font-semibold text-[#F87171]">{t("weaknesses")}</h4>
                  <ul className="space-y-1">
                    {(Array.isArray(weaknesses) ? weaknesses : []).map((w, i) => (
                      <li key={i} className="text-xs text-[#9B9594]">- {w}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
