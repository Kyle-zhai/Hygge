"use client";

import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

const leaningConfig: Record<string, { color: string; label: string; labelZh: string }> = {
  strongly_positive: { color: "bg-[#34D399]/10 text-[#34D399]", label: "Strongly Positive", labelZh: "强烈正面" },
  positive: { color: "bg-[#4ADE80]/10 text-[#4ADE80]", label: "Positive", labelZh: "正面" },
  neutral: { color: "bg-[#FBBF24]/10 text-[#FBBF24]", label: "Neutral", labelZh: "中立" },
  negative: { color: "bg-[#F97316]/10 text-[#F97316]", label: "Negative", labelZh: "负面" },
  strongly_negative: { color: "bg-[#F87171]/10 text-[#F87171]", label: "Strongly Negative", labelZh: "强烈负面" },
  // Legacy compat
  strongly_support: { color: "bg-[#34D399]/10 text-[#34D399]", label: "Strongly Positive", labelZh: "强烈正面" },
  support: { color: "bg-[#4ADE80]/10 text-[#4ADE80]", label: "Positive", labelZh: "正面" },
  oppose: { color: "bg-[#F97316]/10 text-[#F97316]", label: "Negative", labelZh: "负面" },
  strongly_oppose: { color: "bg-[#F87171]/10 text-[#F87171]", label: "Strongly Negative", labelZh: "强烈负面" },
};

function StanceBadge({ leaning, locale }: { leaning: string; locale: string }) {
  const cfg = leaningConfig[leaning] || leaningConfig.neutral;
  return (
    <Badge className={`text-[10px] font-medium ${cfg.color}`}>
      {locale === "zh" ? cfg.labelZh : cfg.label}
    </Badge>
  );
}

function StanceDistribution({ positive, negative, neutral, locale }: { positive: number; negative: number; neutral: number; locale: string }) {
  const total = positive + negative + neutral;
  if (total === 0) return null;
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-2 flex-1 overflow-hidden rounded-full bg-[#1C1C1C]">
        {negative > 0 && <div className="bg-[#F87171]" style={{ width: `${(negative / total) * 100}%` }} />}
        {neutral > 0 && <div className="bg-[#FBBF24]" style={{ width: `${(neutral / total) * 100}%` }} />}
        {positive > 0 && <div className="bg-[#4ADE80]" style={{ width: `${(positive / total) * 100}%` }} />}
      </div>
      <span className="text-[10px] text-[#666462] shrink-0">
        {positive}{locale === "zh" ? "正面" : "P"} · {neutral}{locale === "zh" ? "中立" : "N"} · {negative}{locale === "zh" ? "负面" : "Neg"}
      </span>
    </div>
  );
}

export function ReportScoresView({ report, reviews, personas, locale, onBack, topicClassification, mode = "product" }: ReportScoresViewProps) {
  const isTopicMode = mode === "topic";
  const t = useTranslations("evaluation");

  const personaMap = new Map(personas.map((p) => [p.id, p]));

  return (
    <motion.div
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

      {/* Header: Overall Score / Consensus Score + Market Readiness */}
      {report && (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <div className="text-5xl font-semibold text-[#EAEAE8]">
            {isTopicMode ? `${report.consensus_score ?? 0}%` : report.overall_score}
          </div>
          <p className="text-sm text-[#9B9594]">
            {isTopicMode ? (locale === "zh" ? "观点统一度" : "Consensus") : t("overallScore")}
          </p>
          <Badge className={readinessColors[report.market_readiness] || ""}>
            {report.readiness_label_en
              ? (locale === "zh" ? (report.readiness_label_zh || report.readiness_label_en) : report.readiness_label_en)
              : t("marketReadiness")}: {t(report.market_readiness as "low" | "medium" | "high")}
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
            const occupation = locale === "zh"
              ? (persona?.demographics?.occupation || "")
              : (persona?.identity?.locale_variants?.en?.tagline || persona?.demographics?.occupation || "");
            return (
              <PersonaReviewCard
                key={review.id}
                personaName={localized?.name || "Unknown"}
                personaAvatar={persona?.identity?.avatar || "?"}
                personaOccupation={occupation}
                scores={review.scores}
                reviewText={review.review_text}
                strengths={review.strengths}
                weaknesses={review.weaknesses}
                topicDimensions={topicClassification?.dimensions}
                locale={locale}
                stanceMode={isTopicMode}
                overallStance={review.overall_stance}
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
                    <h3 className="text-sm font-semibold text-[#EAEAE8]">{(locale === "zh" ? dim.label_zh : dim.label_en) || t(dim.dimension as any)}</h3>
                    {isTopicMode && dim.overall_leaning ? (
                      <StanceBadge leaning={dim.overall_leaning} locale={locale} />
                    ) : (
                      <span className="text-sm font-bold text-[#EAEAE8]">{dim.score}</span>
                    )}
                  </div>
                  {/* Stance distribution bar for topic mode */}
                  {isTopicMode && (dim.positive_count != null || dim.support_count != null) && (
                    <StanceDistribution positive={dim.positive_count ?? dim.support_count ?? 0} negative={dim.negative_count ?? dim.oppose_count ?? 0} neutral={dim.neutral_count ?? 0} locale={locale} />
                  )}
                  <p className="text-sm text-[#9B9594]">{dim.analysis}</p>
                  {/* Key arguments for topic mode */}
                  {isTopicMode && dim.key_arguments ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {(dim.key_arguments.positive || dim.key_arguments.for) && (
                        <div className="rounded-lg bg-[#4ADE80]/5 border border-[#4ADE80]/10 p-2.5">
                          <span className="text-[10px] font-semibold text-[#4ADE80] uppercase">{locale === "zh" ? "正面论点" : "Positive"}</span>
                          <p className="mt-1 text-xs text-[#9B9594] leading-relaxed">{dim.key_arguments.positive || dim.key_arguments.for}</p>
                        </div>
                      )}
                      {(dim.key_arguments.negative || dim.key_arguments.against) && (
                        <div className="rounded-lg bg-[#F87171]/5 border border-[#F87171]/10 p-2.5">
                          <span className="text-[10px] font-semibold text-[#F87171] uppercase">{locale === "zh" ? "负面论点" : "Negative"}</span>
                          <p className="mt-1 text-xs text-[#9B9594] leading-relaxed">{dim.key_arguments.negative || dim.key_arguments.against}</p>
                        </div>
                      )}
                    </div>
                  ) : (
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
                  )}
                </div>
              ))}
            </div>
          </ReportSection>

          {/* Goal Assessment (product mode only) */}
          {!isTopicMode && <ReportSection title={t("goalAssessment")} borderColor="border-l-[#FBBF24]">
            <div className="space-y-3">
              {report.goal_assessment?.map((goal, i) => (
                <div key={i} className="flex items-start gap-3 rounded-lg bg-[#1C1C1C]/50 p-3">
                  <Badge variant="secondary" className={goal.achievable ? "bg-[#4ADE80]/10 text-[#4ADE80]" : "bg-[#F87171]/10 text-[#F87171]"}>
                    {goal.achievable ? t("achievable") : t("notAchievable")}
                  </Badge>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[#EAEAE8]">{goal.goal}</p>
                    <p className="mt-1 text-xs text-[#9B9594]">{goal.current_status}</p>
                    {Array.isArray(goal.gaps) && goal.gaps.length > 0 && (
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
          </ReportSection>}

          {/* If Not Feasible (product mode only) */}
          {!isTopicMode && <ReportSection title={t("ifNotFeasible")} borderColor="border-l-[#F87171]">
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
          </ReportSection>}

          {/* If Feasible (product mode only) */}
          {!isTopicMode && <ReportSection title={t("ifFeasible")} borderColor="border-l-[#4ADE80]">
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
          </ReportSection>}

          {/* Action Items (product mode only) */}
          {!isTopicMode && <ReportSection title={t("actionItems")} borderColor="border-l-[#E2DDD5]">
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
          </ReportSection>}

        </>
      )}
    </motion.div>
  );
}
