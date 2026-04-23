import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ReportView } from "@/components/evaluation/report-view";
import { CompareResultView } from "@/components/evaluation/compare-result-view";

type ReviewRow = {
  id: string;
  persona_id: string;
  scores?: unknown;
  review_text?: string;
  strengths?: string[];
  weaknesses?: string[];
  llm_model?: string;
  created_at?: string;
  overall_stance?: unknown;
  cited_references?: unknown;
};
type PersonaRow = {
  id: string;
  identity: { name: string; avatar?: string; locale_variants?: Record<string, { name?: string }> };
  demographics?: unknown;
  category?: string;
};
type EvaluationRow = {
  id: string;
  project_id: string;
  status: string;
  mode?: string | null;
  topic_classification?: unknown;
  selected_persona_ids?: string[];
  created_at?: string;
  completed_at?: string | null;
  comparison_base_id?: string | null;
  persona_reviews?: ReviewRow[] | null;
  summary_reports?: unknown;
};
type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

async function fetchEvaluation(supabase: SupabaseServerClient, id: string) {
  const { data } = await supabase
    .from("evaluations")
    .select(`id, project_id, status, mode, topic_classification, selected_persona_ids, created_at, completed_at, comparison_base_id,
      persona_reviews (id, persona_id, scores, review_text, strengths, weaknesses, llm_model, created_at, overall_stance, cited_references),
      summary_reports (*)`)
    .eq("id", id)
    .single();
  return data as EvaluationRow | null;
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

  const reviews = evaluation.persona_reviews ?? [];

  const personaIds = Array.from(new Set([
    ...(Array.isArray(evaluation.selected_persona_ids) ? evaluation.selected_persona_ids : []).map(String),
    ...reviews.map((r) => String(r.persona_id)),
  ]));
  let personas: PersonaRow[] = [];
  if (personaIds.length > 0) {
    const { data, error } = await supabase
      .from("personas")
      .select("id, identity, demographics, category")
      .in("id", personaIds);
    if (error) {
      console.error("[ResultPage] Persona fetch failed:", error.message, "ids:", personaIds);
    }
    personas = (data ?? []) as PersonaRow[];
    if (personas.length === 0 && personaIds.length > 0) {
      console.error("[ResultPage] Persona query returned 0 rows. personaIds:", JSON.stringify(personaIds), "selected_persona_ids:", JSON.stringify(evaluation.selected_persona_ids), "review persona_ids:", reviews.map((r) => r.persona_id));
    }
  }
  const reportData = evaluation.summary_reports;
  const report = Array.isArray(reportData) ? reportData[0] ?? null : reportData ?? null;
  const topicClassification = evaluation.topic_classification || null;

  if (evaluation.comparison_base_id) {
    const baseEval = await fetchEvaluation(supabase, evaluation.comparison_base_id);
    if (baseEval && baseEval.status === "completed") {
      const baseReviews = baseEval.persona_reviews ?? [];
      const basePersonaIds = Array.from(new Set([
        ...(Array.isArray(baseEval.selected_persona_ids) ? baseEval.selected_persona_ids : []).map(String),
        ...baseReviews.map((r) => String(r.persona_id)),
      ]));
      let basePersonas: PersonaRow[] = [];
      if (basePersonaIds.length > 0) {
        const { data, error } = await supabase
          .from("personas")
          .select("id, identity, demographics, category")
          .in("id", basePersonaIds);
        if (error) {
          console.error("[ResultPage] Base persona fetch failed:", error.message);
        }
        basePersonas = (data ?? []) as PersonaRow[];
      }
      const baseReportData = baseEval.summary_reports;
      const baseReport = Array.isArray(baseReportData) ? baseReportData[0] ?? null : baseReportData ?? null;
      const baseTopicClassification = baseEval.topic_classification || null;

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
          baseReport={baseReport as Parameters<typeof CompareResultView>[0]["baseReport"]}
          baseReviews={baseReviews as Parameters<typeof CompareResultView>[0]["baseReviews"]}
          basePersonas={basePersonas as Parameters<typeof CompareResultView>[0]["basePersonas"]}
          baseTitle={baseProject?.parsed_data?.name || "Baseline"}
          newReport={report as Parameters<typeof CompareResultView>[0]["newReport"]}
          newReviews={reviews as Parameters<typeof CompareResultView>[0]["newReviews"]}
          newPersonas={personas as Parameters<typeof CompareResultView>[0]["newPersonas"]}
          newTitle={newProject?.parsed_data?.name || "New Version"}
          topicClassification={(topicClassification || baseTopicClassification) as Parameters<typeof CompareResultView>[0]["topicClassification"]}
          mode={evaluation.mode === "topic" ? "topic" : "product"}
          locale={locale}
        />
      );
    }
  }

  return (
    <ReportView
      report={report as Parameters<typeof ReportView>[0]["report"]}
      reviews={reviews as Parameters<typeof ReportView>[0]["reviews"]}
      personas={personas as Parameters<typeof ReportView>[0]["personas"]}
      locale={locale}
      evaluationId={evaluation.id}
      topicClassification={topicClassification as Parameters<typeof ReportView>[0]["topicClassification"]}
      mode={evaluation.mode === "topic" ? "topic" : "product"}
    />
  );
}
