"use client";

import { useTranslations } from "next-intl";
import { motion } from "framer-motion";

interface ScoreBarProps {
  scores: {
    usability: number;
    market_fit: number;
    design: number;
    tech_quality: number;
    innovation: number;
    pricing: number;
  };
  compact?: boolean;
}

const dimensions = ["usability", "market_fit", "design", "tech_quality", "innovation", "pricing"] as const;

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

export function ScoreBar({ scores, compact }: ScoreBarProps) {
  const t = useTranslations("evaluation");

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      {dimensions.map((dim, i) => {
        const score = scores[dim];
        return (
          <div key={dim} className="flex items-center gap-2">
            <span className={`${compact ? "w-16 text-[11px]" : "w-24 text-xs"} text-[#666462] truncate`}>
              {t(dim)}
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
