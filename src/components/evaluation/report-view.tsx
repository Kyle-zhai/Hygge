"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { ReportTextView } from "@/components/evaluation/report-text-view";
import { ReportScoresView } from "@/components/evaluation/report-scores-view";

interface PersonaData {
  id: string;
  identity: any;
  demographics: any;
  category: string;
}

interface ReviewData {
  id: string;
  persona_id: string;
  scores: {
    usability: number;
    market_fit: number;
    design: number;
    tech_quality: number;
    innovation: number;
    pricing: number;
  };
  review_text: string;
  strengths: string[];
  weaknesses: string[];
}

interface ReportData {
  overall_score: number;
  market_readiness: string;
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
    score: number;
    analysis: string;
    strengths?: string[];
    weaknesses?: string[];
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
}

interface ReportViewProps {
  report: ReportData | null;
  reviews: ReviewData[];
  personas: PersonaData[];
  locale: string;
}

type ViewMode = "report" | "scores";

export function ReportView({ report, reviews, personas, locale }: ReportViewProps) {
  const t = useTranslations("evaluation");
  const [mode, setMode] = useState<ViewMode>("report");

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-16">
      {/* Tab Toggle */}
      <div className="flex items-center justify-center">
        <div className="inline-flex rounded-lg border border-[#2A2A2A] bg-[#141414] p-1">
          <button
            onClick={() => setMode("report")}
            className={`relative rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              mode === "report"
                ? "text-[#EAEAE8]"
                : "text-[#9B9594] hover:text-[#EAEAE8]"
            }`}
          >
            {mode === "report" && (
              <motion.div
                layoutId="report-tab-indicator"
                className="absolute inset-0 rounded-md bg-[#2A2A2A]"
                transition={{ type: "spring", duration: 0.4, bounce: 0.15 }}
              />
            )}
            <span className="relative z-10">{t("reportTab")}</span>
          </button>
          <button
            onClick={() => setMode("scores")}
            className={`relative rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              mode === "scores"
                ? "text-[#EAEAE8]"
                : "text-[#9B9594] hover:text-[#EAEAE8]"
            }`}
          >
            {mode === "scores" && (
              <motion.div
                layoutId="report-tab-indicator"
                className="absolute inset-0 rounded-md bg-[#2A2A2A]"
                transition={{ type: "spring", duration: 0.4, bounce: 0.15 }}
              />
            )}
            <span className="relative z-10">{t("scoresTab")}</span>
          </button>
        </div>
      </div>

      {/* View Content */}
      {mode === "report" ? (
        <ReportTextView
          report={report}
          reviews={reviews}
          personas={personas}
          locale={locale}
        />
      ) : (
        <ReportScoresView
          report={report}
          reviews={reviews}
          personas={personas}
          locale={locale}
        />
      )}
    </div>
  );
}
