"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScoreBar } from "./score-radar";
import { ChevronDown, ChevronUp } from "lucide-react";

interface PersonaReviewCardProps {
  personaName: string;
  personaAvatar: string;
  personaOccupation: string;
  scores: {
    usability: number;
    market_fit: number;
    design: number;
    tech_quality: number;
    innovation: number;
    pricing: number;
  };
  reviewText: string;
  strengths: string[];
  weaknesses: string[];
}

export function PersonaReviewCard({
  personaName,
  personaAvatar,
  personaOccupation,
  scores,
  reviewText,
  strengths,
  weaknesses,
}: PersonaReviewCardProps) {
  const t = useTranslations("evaluation");
  const [expanded, setExpanded] = useState(false);
  const avgScore = Object.values(scores).reduce((a, b) => a + b, 0) / 6;

  const scoreBadgeColor =
    avgScore >= 7
      ? "border-[#4ADE80]/30 bg-[#4ADE80]/10 text-[#4ADE80]"
      : avgScore >= 5
      ? "border-[#FBBF24]/30 bg-[#FBBF24]/10 text-[#FBBF24]"
      : "border-[#F87171]/30 bg-[#F87171]/10 text-[#F87171]";

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
              <Badge variant="secondary" className={`border text-xs font-medium ${scoreBadgeColor}`}>
                {avgScore.toFixed(1)}
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
        <ScoreBar scores={scores} compact />

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
                    {strengths.map((s, i) => (
                      <li key={i} className="text-xs text-[#9B9594]">+ {s}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-lg border border-[#F87171]/20 bg-[#F87171]/5 p-3">
                  <h4 className="mb-2 text-xs font-semibold text-[#F87171]">{t("weaknesses")}</h4>
                  <ul className="space-y-1">
                    {weaknesses.map((w, i) => (
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
