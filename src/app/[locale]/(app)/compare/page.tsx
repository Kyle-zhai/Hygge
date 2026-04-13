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

  const completedEvaluations = (projects || []).flatMap((p: any) => {
    const evals = Array.isArray(p.evaluations) ? p.evaluations : p.evaluations ? [p.evaluations] : [];
    return evals
      .filter((e: any) => e.status === "completed" && !e.comparison_base_id)
      .map((e: any) => ({
        evaluationId: e.id as string,
        title: (p.parsed_data?.name || p.raw_input?.slice(0, 60) || "Untitled") as string,
        mode: (e.mode || "product") as "product" | "topic",
        completedAt: e.completed_at as string | null,
        personaCount: (e.selected_persona_ids?.length || 0) as number,
      }));
  });

  return <CompareCreateView evaluations={completedEvaluations} locale={locale} />;
}
