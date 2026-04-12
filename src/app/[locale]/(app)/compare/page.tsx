import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CompareView, type CompareItem } from "@/components/evaluation/compare-view";

export default async function ComparePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/auth/login`);

  const { data: projects } = await supabase
    .from("projects")
    .select(`
      id,
      raw_input,
      parsed_data,
      created_at,
      evaluations (
        id,
        mode,
        status,
        completed_at,
        summary_reports (
          overall_score,
          market_readiness,
          persona_analysis,
          action_items,
          multi_dimensional_analysis
        )
      )
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const items: CompareItem[] = (projects || []).flatMap((p: any) => {
    const evals = Array.isArray(p.evaluations) ? p.evaluations : p.evaluations ? [p.evaluations] : [];
    return evals
      .filter((e: any) => e.status === "completed" && e.summary_reports)
      .map((e: any) => {
        const report = Array.isArray(e.summary_reports) ? e.summary_reports[0] : e.summary_reports;
        const rawTitle = p.parsed_data?.name || p.raw_input || "";
        return {
          evaluationId: e.id as string,
          projectId: p.id as string,
          title: rawTitle.slice(0, 80) + (rawTitle.length > 80 ? "…" : ""),
          mode: (e.mode === "product" ? "product" : "topic") as "product" | "topic",
          completedAt: e.completed_at as string | null,
          createdAt: p.created_at as string,
          overallScore: typeof report?.overall_score === "number" ? report.overall_score : null,
          marketReadiness: (report?.market_readiness as string | null) ?? null,
          multiDimensional: Array.isArray(report?.multi_dimensional_analysis) ? report.multi_dimensional_analysis : [],
          personaAnalysis: report?.persona_analysis ?? null,
          actionItems: Array.isArray(report?.action_items) ? report.action_items : [],
        };
      });
  });

  return <CompareView items={items} locale={locale} />;
}
