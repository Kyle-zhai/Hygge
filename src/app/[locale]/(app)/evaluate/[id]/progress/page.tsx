import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProgressTracker } from "@/components/evaluation/progress-tracker";

export default async function EvaluationProgressPage({
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
    .select(`id, status, selected_persona_ids, persona_reviews (persona_id)`)
    .eq("id", id)
    .single();

  if (!evaluation) redirect(`/${locale}/dashboard`);

  if (evaluation.status === "completed") {
    redirect(`/${locale}/evaluate/${id}/result`);
  }

  const { data: personas } = await supabase
    .from("personas")
    .select("id, identity")
    .in("id", evaluation.selected_persona_ids);

  const personaInfos = (personas || []).map((p: any) => ({
    id: p.id,
    name: p.identity.locale_variants?.[locale]?.name || p.identity.name,
    avatar: p.identity.avatar,
  }));

  const completedIds = ((evaluation as any).persona_reviews || []).map((r: any) => r.persona_id);

  return (
    <ProgressTracker
      evaluationId={id}
      personas={personaInfos}
      initialCompletedIds={completedIds}
      initialStatus={evaluation.status}
    />
  );
}
