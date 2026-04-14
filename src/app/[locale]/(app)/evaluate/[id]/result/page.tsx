import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ReportView } from "@/components/evaluation/report-view";
import { CompareResultView } from "@/components/evaluation/compare-result-view";

async function fetchEvaluation(supabase: any, id: string) {
  const { data } = await supabase
    .from("evaluations")
    .select(`id, project_id, status, mode, topic_classification, selected_persona_ids, created_at, completed_at, comparison_base_id,
      persona_reviews (id, persona_id, scores, review_text, strengths, weaknesses, llm_model, created_at, overall_stance, cited_references),
      summary_reports (*)`)
    .eq("id", id)
    .single();
  return data;
}

export default async function EvaluationResultPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect(`/${locale}/auth/login`);

  const evaluation = await fetchEvaluation(supabase, id);

  if (!evaluation || evaluation.status !== "completed") {
    redirect(`/${locale}/evaluate/new`);
  }

  const reviews = (evaluation as any).persona_reviews || [];

  const personaIds = Array.from(new Set([
    ...(evaluation.selected_persona_ids || []).map(String),
    ...reviews.map((r: any) => String(r.persona_id)),
  ]));
  const { data: personas } = personaIds.length > 0
    ? await supabase.from("personas").select("id, identity, demographics, category").in("id", personaIds)
    : { data: [] };
  const reportData = (evaluation as any).summary_reports;
  const report = Array.isArray(reportData) ? reportData[0] ?? null : reportData ?? null;
  const topicClassification = (evaluation as any).topic_classification || null;

  if (evaluation.comparison_base_id) {
    const baseEval = await fetchEvaluation(supabase, evaluation.comparison_base_id);
    if (baseEval && baseEval.status === "completed") {
      const baseReviews = (baseEval as any).persona_reviews || [];
      const basePersonaIds = Array.from(new Set([
        ...(baseEval.selected_persona_ids || []).map(String),
        ...baseReviews.map((r: any) => String(r.persona_id)),
      ]));
      const { data: basePersonas } = basePersonaIds.length > 0
        ? await supabase.from("personas").select("id, identity, demographics, category").in("id", basePersonaIds)
        : { data: [] };
      const baseReportData = (baseEval as any).summary_reports;
      const baseReport = Array.isArray(baseReportData) ? baseReportData[0] ?? null : baseReportData ?? null;
      const baseTopicClassification = (baseEval as any).topic_classification || null;

      const { data: baseProject } = await supabase
        .from("projects")
        .select("parsed_data")
        .eq("id", baseEval.project_id)
        .single();

      const { data: newProject } = await supabase
        .from("projects")
        .select("parsed_data")
        .eq("id", evaluation.project_id)
        .single();

      return (
        <CompareResultView
          baseReport={baseReport}
          baseReviews={baseReviews}
          basePersonas={basePersonas || []}
          baseTitle={baseProject?.parsed_data?.name || "Baseline"}
          newReport={report}
          newReviews={reviews}
          newPersonas={personas || []}
          newTitle={newProject?.parsed_data?.name || "New Version"}
          topicClassification={topicClassification || baseTopicClassification}
          mode={evaluation.mode === "topic" ? "topic" : "product"}
          locale={locale}
        />
      );
    }
  }

  return (
    <ReportView
      report={report}
      reviews={reviews}
      personas={personas || []}
      locale={locale}
      evaluationId={evaluation.id}
      topicClassification={topicClassification}
      mode={evaluation.mode === "topic" ? "topic" : "product"}
    />
  );
}
