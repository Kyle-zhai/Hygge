import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { PersonaReviewCard } from "@/components/evaluation/persona-review-card";
import { ReportSection } from "@/components/evaluation/report-section";

const readinessColors: Record<string, string> = {
  low: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  high: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

const priorityColors: Record<string, string> = {
  critical: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  low: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

export default async function EvaluationResultPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale } = await params;
  const t = await getTranslations("evaluation");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect(`/${locale}/auth/login`);

  const { data: evaluation } = await supabase
    .from("evaluations")
    .select(`id, status, selected_persona_ids, created_at, completed_at,
      persona_reviews (id, persona_id, scores, review_text, strengths, weaknesses, llm_model, created_at),
      summary_reports (*)`)
    .eq("id", id)
    .single();

  if (!evaluation || evaluation.status !== "completed") {
    redirect(`/${locale}/dashboard`);
  }

  const { data: personas } = await supabase
    .from("personas")
    .select("id, identity, demographics, category")
    .in("id", evaluation.selected_persona_ids);

  const personaMap = new Map(
    (personas || []).map((p: any) => [p.id, p])
  );

  const reviews = (evaluation as any).persona_reviews || [];
  const report = ((evaluation as any).summary_reports || [])[0];

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-16">
      {/* Header: Overall Score + Market Readiness */}
      {report && (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <div className="text-5xl font-bold">{report.overall_score}</div>
          <p className="text-sm text-muted-foreground">{t("overallScore")}</p>
          <Badge className={readinessColors[report.market_readiness] || ""}>
            {t("marketReadiness")}: {t(report.market_readiness as "low" | "medium" | "high")}
          </Badge>
        </div>
      )}

      {/* Individual Persona Reviews */}
      <div>
        <h2 className="mb-4 text-xl font-bold">{t("personaAnalysis")}</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {reviews.map((review: any) => {
            const persona = personaMap.get(review.persona_id) as any;
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
          <ReportSection title={t("consensus")} borderColor="border-l-violet-500">
            <ul className="space-y-2">
              {report.persona_analysis?.consensus?.map((c: any, i: number) => (
                <li key={i} className="text-sm">
                  <span className="font-medium">{c.point}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    ({c.supporting_personas?.join(", ")})
                  </span>
                </li>
              ))}
            </ul>
          </ReportSection>

          {/* Disagreements */}
          {report.persona_analysis?.disagreements?.length > 0 && (
            <ReportSection title={t("disagreements")} borderColor="border-l-orange-500">
              <div className="space-y-3">
                {report.persona_analysis.disagreements.map((d: any, i: number) => (
                  <div key={i} className="text-sm">
                    <p className="font-medium">{d.point}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{d.reason}</p>
                  </div>
                ))}
              </div>
            </ReportSection>
          )}

          {/* Multi-Dimensional Analysis */}
          <ReportSection title={t("dimensionAnalysis")} borderColor="border-l-blue-500">
            <div className="space-y-6">
              {report.multi_dimensional_analysis?.map((dim: any, i: number) => (
                <div key={i} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">{t(dim.dimension)}</h3>
                    <span className="text-sm font-bold">{dim.score}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{dim.analysis}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <span className="text-xs font-medium text-green-600">{t("strengths")}:</span>
                      <ul className="mt-1 space-y-0.5">
                        {dim.strengths?.map((s: string, j: number) => (
                          <li key={j} className="text-xs text-muted-foreground">+ {s}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-red-600">{t("weaknesses")}:</span>
                      <ul className="mt-1 space-y-0.5">
                        {dim.weaknesses?.map((w: string, j: number) => (
                          <li key={j} className="text-xs text-muted-foreground">- {w}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ReportSection>

          {/* Goal Assessment */}
          <ReportSection title={t("goalAssessment")} borderColor="border-l-yellow-500">
            <div className="space-y-3">
              {report.goal_assessment?.map((goal: any, i: number) => (
                <div key={i} className="flex items-start gap-3 rounded-lg bg-muted/50 p-3">
                  <Badge variant="secondary" className={goal.achievable ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"}>
                    {goal.achievable ? t("achievable") : t("notAchievable")}
                  </Badge>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{goal.goal}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{goal.current_status}</p>
                    {goal.gaps?.length > 0 && (
                      <ul className="mt-1 space-y-0.5">
                        {goal.gaps.map((g: string, j: number) => (
                          <li key={j} className="text-xs text-muted-foreground">- {g}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ReportSection>

          {/* If Not Feasible */}
          <ReportSection title={t("ifNotFeasible")} borderColor="border-l-red-500">
            <div className="space-y-3">
              <div>
                <h4 className="text-sm font-semibold">{t("direction")}</h4>
                <p className="text-sm text-muted-foreground">{report.if_not_feasible?.direction}</p>
              </div>
              <div>
                <h4 className="text-sm font-semibold">{t("modifications")}</h4>
                <ul className="mt-1 space-y-1">
                  {report.if_not_feasible?.modifications?.map((m: string, i: number) => (
                    <li key={i} className="text-sm text-muted-foreground">- {m}</li>
                  ))}
                </ul>
              </div>
              {report.if_not_feasible?.reference_cases?.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold">{t("referenceCases")}</h4>
                  <ul className="mt-1 space-y-1">
                    {report.if_not_feasible.reference_cases.map((r: string, i: number) => (
                      <li key={i} className="text-sm text-muted-foreground">{r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </ReportSection>

          {/* If Feasible */}
          <ReportSection title={t("ifFeasible")} borderColor="border-l-green-500">
            <div className="space-y-3">
              <div>
                <h4 className="text-sm font-semibold">{t("nextSteps")}</h4>
                <ul className="mt-1 space-y-1">
                  {report.if_feasible?.next_steps?.map((s: string, i: number) => (
                    <li key={i} className="text-sm text-muted-foreground">- {s}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-semibold">{t("risks")}</h4>
                <ul className="mt-1 space-y-1">
                  {report.if_feasible?.risks?.map((r: string, i: number) => (
                    <li key={i} className="text-sm text-muted-foreground">- {r}</li>
                  ))}
                </ul>
              </div>
            </div>
          </ReportSection>

          {/* Action Items */}
          <ReportSection title={t("actionItems")} borderColor="border-l-cyan-500">
            <div className="space-y-2">
              {report.action_items?.map((item: any, i: number) => (
                <div key={i} className="flex items-start gap-3 rounded-lg bg-muted/50 p-3">
                  <Badge variant="secondary" className={priorityColors[item.priority] || ""}>
                    {t(item.priority as "critical" | "high" | "medium" | "low")}
                  </Badge>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{item.description}</p>
                    <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
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
            <ReportSection title={t("scenarioSimulation")} borderColor="border-l-purple-500">
              <div className="space-y-4">
                <p className="text-sm">{report.scenario_simulation.summary}</p>
                <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3">
                  <span className="text-sm font-medium">{t("adoptionShift")}:</span>
                  <span className={`text-lg font-bold ${report.scenario_simulation.adoption_rate_shift >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {report.scenario_simulation.adoption_rate_shift >= 0 ? "+" : ""}{report.scenario_simulation.adoption_rate_shift}%
                  </span>
                </div>
                {report.scenario_simulation.influence_events?.length > 0 && (
                  <div className="space-y-2">
                    {report.scenario_simulation.influence_events.map((event: any, i: number) => {
                      const influencer = personaMap.get(event.influencer_id) as any;
                      const influenced = personaMap.get(event.influenced_id) as any;
                      const getName = (p: any) => p?.identity?.locale_variants?.[locale]?.name || p?.identity?.name || "?";
                      return (
                        <div key={i} className="rounded bg-muted/30 p-2 text-xs">
                          <span className="font-medium">{getName(influencer)}</span>
                          {" → "}
                          <span className="font-medium">{getName(influenced)}</span>
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
    </div>
  );
}
