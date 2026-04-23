import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CompareCreateView } from "@/components/evaluation/compare-create-view";

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
        selected_persona_ids,
        comparison_base_id
      )
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  type EvalRow = {
    id: string;
    mode?: string | null;
    status?: string | null;
    completed_at?: string | null;
    selected_persona_ids?: string[] | null;
    comparison_base_id?: string | null;
  };
  type ProjectRow = {
    parsed_data?: { name?: string } | null;
    raw_input?: string | null;
    evaluations?: EvalRow | EvalRow[] | null;
  };
  const completedEvaluations = ((projects ?? []) as ProjectRow[]).flatMap((p) => {
    const evals = Array.isArray(p.evaluations) ? p.evaluations : p.evaluations ? [p.evaluations] : [];
    return evals
      .filter(
        (e) =>
          e.status === "completed" &&
          !e.comparison_base_id &&
          (e.mode || "product") === "product",
      )
      .map((e) => ({
        evaluationId: e.id as string,
        title: (p.parsed_data?.name || p.raw_input?.slice(0, 60) || "Untitled") as string,
        mode: "product" as const,
        completedAt: e.completed_at as string | null,
        personaCount: (e.selected_persona_ids?.length || 0) as number,
      }));
  });

  return <CompareCreateView evaluations={completedEvaluations} locale={locale} />;
}
