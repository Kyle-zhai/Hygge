"use client";

import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { PersonaReviewCard } from "@/components/evaluation/persona-review-card";
import { ReportSection } from "@/components/evaluation/report-section";

const readinessColors: Record<string, string> = {
  low: "bg-[#F87171]/10 text-[#F87171]",
  medium: "bg-[#FBBF24]/10 text-[#FBBF24]",
  high: "bg-[#4ADE80]/10 text-[#4ADE80]",
};

const priorityColors: Record<string, string> = {
  critical: "bg-[#F87171]/10 text-[#F87171]",
  high: "bg-[#F97316]/10 text-[#F97316]",
  medium: "bg-[#FBBF24]/10 text-[#FBBF24]",
  low: "bg-[#1C1C1C] text-[#9B9594]",
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

interface ReportScoresViewProps {
  report: ReportData | null;
  reviews: ReviewData[];
  personas: PersonaData[];
  locale: string;
}

export function ReportScoresView({ report, reviews, personas, locale }: ReportScoresViewProps) {
  const t = useTranslations("evaluation");

  const personaMap = new Map(personas.map((p) => [p.id, p]));

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-8"
    >
      {/* Header: Overall Score + Market Readiness */}
      {report && (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <div className="text-5xl font-semibold text-[#EAEAE8]">
            {report.overall_score}
          </div>
          <p className="text-sm text-[#9B9594]">{t("overallScore")}</p>
          <Badge className={readinessColors[report.market_readiness] || ""}>
            {t("marketReadiness")}: {t(report.market_readiness as "low" | "medium" | "high")}
          </Badge>
        </div>
      )}

      {/* Individual Persona Reviews */}
      <div>
        <h2 className="mb-4 text-xl font-semibold text-[#EAEAE8]">
          {t("personaAnalysis")}
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {reviews.map((review) => {
            const persona = personaMap.get(review.persona_id);
            const localized = persona?.identity?.locale_variants?.[locale] || persona?.identity;
            return (
              <PersonaReviewCard
                key={review.id}
                personaName={localized?.name || "Unknown"}
                personaAvatar={persona?.identity?.avatar || "?"}
                personaOccupation={persona?.demographics?.occupation || ""}
                scores={review.scores}
                reviewText={review.review_text}
                strengths={review.strengths}
                weaknesses={review.weaknesses}
              />
            );
          })}
        </div>
      </div>

      {report && (
        <>
          {/* Consensus */}
          <ReportSection title={t("consensus")} borderColor="border-l-[#E2DDD5]">
            <ul className="space-y-2">
              {report.persona_analysis?.consensus?.map((c, i) => (
                <li key={i} className="text-sm">
                  <span className="font-medium text-[#EAEAE8]">{c.point}</span>
                  <span className="ml-2 text-xs text-[#666462]">
                    ({c.supporting_personas?.join(", ")})
                  </span>
                </li>
              ))}
            </ul>
          </ReportSection>

          {/* Disagreements */}
          {report.persona_analysis?.disagreements?.length > 0 && (
            <ReportSection title={t("disagreements")} borderColor="border-l-[#FBBF24]">
              <div className="space-y-3">
                {report.persona_analysis.disagreements.map((d, i) => (
                  <div key={i} className="text-sm">
                    <p className="font-medium text-[#EAEAE8]">{d.point}</p>
                    <p className="mt-1 text-xs text-[#9B9594]">{d.reason}</p>
                  </div>
                ))}
              </div>
            </ReportSection>
          )}

          {/* Multi-Dimensional Analysis */}
          <ReportSection title={t("dimensionAnalysis")} borderColor="border-l-[#4ADE80]">
            <div className="space-y-6">
              {report.multi_dimensional_analysis?.map((dim, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-[#EAEAE8]">{t(dim.dimension)}</h3>
                    <span className="text-sm font-bold text-[#EAEAE8]">{dim.score}</span>
                  </div>
                  <p className="text-sm text-[#9B9594]">{dim.analysis}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <span className="text-xs font-medium text-[#4ADE80]">{t("strengths")}:</span>
                      <ul className="mt-1 space-y-0.5">
                        {dim.strengths?.map((s, j) => (
                          <li key={j} className="text-xs text-[#9B9594]">+ {s}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-[#F87171]">{t("weaknesses")}:</span>
                      <ul className="mt-1 space-y-0.5">
                        {dim.weaknesses?.map((w, j) => (
                          <li key={j} className="text-xs text-[#9B9594]">- {w}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ReportSection>

          {/* Goal Assessment */}
          <ReportSection title={t("goalAssessment")} borderColor="border-l-[#FBBF24]">
            <div className="space-y-3">
              {report.goal_assessment?.map((goal, i) => (
                <div key={i} className="flex items-start gap-3 rounded-lg bg-[#1C1C1C]/50 p-3">
                  <Badge variant="secondary" className={goal.achievable ? "bg-[#4ADE80]/10 text-[#4ADE80]" : "bg-[#F87171]/10 text-[#F87171]"}>
                    {goal.achievable ? t("achievable") : t("notAchievable")}
                  </Badge>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[#EAEAE8]">{goal.goal}</p>
                    <p className="mt-1 text-xs text-[#9B9594]">{goal.current_status}</p>
                    {goal.gaps?.length && goal.gaps.length > 0 && (
                      <ul className="mt-1 space-y-0.5">
                        {goal.gaps.map((g, j) => (
                          <li key={j} className="text-xs text-[#9B9594]">- {g}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ReportSection>

          {/* If Not Feasible */}
          <ReportSection title={t("ifNotFeasible")} borderColor="border-l-[#F87171]">
            <div className="space-y-3">
              <div>
                <h4 className="text-sm font-semibold text-[#EAEAE8]">{t("direction")}</h4>
                <p className="text-sm text-[#9B9594]">{report.if_not_feasible?.direction}</p>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-[#EAEAE8]">{t("modifications")}</h4>
                <ul className="mt-1 space-y-1">
                  {report.if_not_feasible?.modifications?.map((m, i) => (
                    <li key={i} className="text-sm text-[#9B9594]">- {m}</li>
                  ))}
                </ul>
              </div>
              {report.if_not_feasible?.reference_cases && report.if_not_feasible.reference_cases.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-[#EAEAE8]">{t("referenceCases")}</h4>
                  <ul className="mt-1 space-y-1">
                    {report.if_not_feasible.reference_cases.map((r, i) => (
                      <li key={i} className="text-sm text-[#9B9594]">{r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </ReportSection>

          {/* If Feasible */}
          <ReportSection title={t("ifFeasible")} borderColor="border-l-[#4ADE80]">
            <div className="space-y-3">
              <div>
                <h4 className="text-sm font-semibold text-[#EAEAE8]">{t("nextSteps")}</h4>
                <ul className="mt-1 space-y-1">
                  {report.if_feasible?.next_steps?.map((s, i) => (
                    <li key={i} className="text-sm text-[#9B9594]">- {s}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-[#EAEAE8]">{t("risks")}</h4>
                <ul className="mt-1 space-y-1">
                  {report.if_feasible?.risks?.map((r, i) => (
                    <li key={i} className="text-sm text-[#9B9594]">- {r}</li>
                  ))}
                </ul>
              </div>
            </div>
          </ReportSection>

          {/* Action Items */}
          <ReportSection title={t("actionItems")} borderColor="border-l-[#E2DDD5]">
            <div className="space-y-2">
              {report.action_items?.map((item, i) => (
                <div key={i} className="flex items-start gap-3 rounded-lg bg-[#1C1C1C]/50 p-3">
                  <Badge variant="secondary" className={priorityColors[item.priority] || ""}>
                    {t(item.priority as "critical" | "high" | "medium" | "low")}
                  </Badge>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[#EAEAE8]">{item.description}</p>
                    <div className="mt-1 flex gap-3 text-xs text-[#666462]">
                      <span>{t("impact")}: {item.expected_impact}</span>
                      <span>{t("difficulty")}: {t(item.difficulty as "easy" | "medium" | "hard")}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ReportSection>

          {/* Scenario Simulation (Max plan only) */}
          {report.scenario_simulation && (
            <ReportSection title={t("scenarioSimulation")} borderColor="border-l-[#E2DDD5]">
              <div className="space-y-4">
                <p className="text-sm text-[#EAEAE8]">{report.scenario_simulation.summary}</p>
                <div className="flex items-center gap-2 rounded-lg bg-[#1C1C1C]/50 p-3">
                  <span className="text-sm font-medium text-[#EAEAE8]">{t("adoptionShift")}:</span>
                  <span className={`text-lg font-bold ${report.scenario_simulation.adoption_rate_shift >= 0 ? "text-[#4ADE80]" : "text-[#F87171]"}`}>
                    {report.scenario_simulation.adoption_rate_shift >= 0 ? "+" : ""}{report.scenario_simulation.adoption_rate_shift}%
                  </span>
                </div>
                {report.scenario_simulation.influence_events && report.scenario_simulation.influence_events.length > 0 && (
                  <div className="space-y-2">
                    {report.scenario_simulation.influence_events.map((event, i) => {
                      const influencer = personaMap.get(event.influencer_id);
                      const influenced = personaMap.get(event.influenced_id);
                      const getName = (p: PersonaData | undefined) =>
                        p?.identity?.locale_variants?.[locale]?.name || p?.identity?.name || "?";
                      return (
                        <div key={i} className="rounded bg-[#1C1C1C]/50 p-2 text-xs">
                          <span className="font-medium text-[#EAEAE8]">{getName(influencer)}</span>
                          {" \u2192 "}
                          <span className="font-medium text-[#EAEAE8]">{getName(influenced)}</span>
                          : {event.shift}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </ReportSection>
          )}
        </>
      )}
    </motion.div>
  );
}
