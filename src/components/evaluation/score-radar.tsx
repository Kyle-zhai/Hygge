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

function scoreColor(score: number): string {
  if (score >= 8) return "bg-green-500";
  if (score >= 6) return "bg-blue-500";
  if (score >= 4) return "bg-yellow-500";
  return "bg-red-500";
}

export function ScoreBar({ scores, compact }: ScoreBarProps) {
  const t = useTranslations("evaluation");

  return (
    <div className={compact ? "space-y-1.5" : "space-y-2"}>
      {dimensions.map((dim) => {
        const score = scores[dim];
        return (
          <div key={dim} className="flex items-center gap-2">
            <span className={`${compact ? "w-16 text-[11px]" : "w-24 text-xs"} text-muted-foreground truncate`}>
              {t(dim)}
            </span>
            <div className="h-1.5 flex-1 rounded-full bg-muted">
              <motion.div
                className={`h-full rounded-full ${scoreColor(score)}`}
                initial={{ width: 0 }}
                animate={{ width: `${score * 10}%` }}
                transition={{ duration: 0.5, delay: 0.1 }}
              />
            </div>
            <span className={`${compact ? "w-5 text-[11px]" : "w-6 text-xs"} text-right font-medium`}>
              {score}
            </span>
          </div>
        );
      })}
    </div>
  );
}
