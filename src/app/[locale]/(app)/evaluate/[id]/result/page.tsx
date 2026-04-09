import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ReportView } from "@/components/evaluation/report-view";

export default async function EvaluationResultPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale } = await params;
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

  const reviews = (evaluation as any).persona_reviews || [];
  const report = (evaluation as any).summary_reports || null;

  return (
    <ReportView
      report={report}
      reviews={reviews}
      personas={personas || []}
      locale={locale}
    />
  );
}
