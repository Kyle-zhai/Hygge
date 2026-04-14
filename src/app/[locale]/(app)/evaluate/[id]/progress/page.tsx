import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DiscussionFeed } from "@/components/evaluation/discussion-feed";

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
    .select(`id, status, mode, selected_persona_ids,
      persona_reviews (persona_id, review_text, scores, strengths, weaknesses),
      projects (parsed_data)`)
    .eq("id", id)
    .single();

  if (!evaluation) redirect(`/${locale}/evaluate/new`);

  if (evaluation.status === "completed") {
    redirect(`/${locale}/evaluate/${id}/result`);
  }

  const topicTitle =
    (evaluation as any).projects?.parsed_data?.name || "Discussion";

  const { data: personas } = await supabase
    .from("personas")
    .select("id, identity")
    .in("id", (evaluation.selected_persona_ids || []).map(String));

  const personaInfos = (personas || []).map((p: any) => ({
    id: p.id,
    name: p.identity.locale_variants?.en?.name || p.identity.name,
    avatar: p.identity.avatar,
  }));

  const initialReviews = ((evaluation as any).persona_reviews || []).map(
    (r: any) => ({
      persona_id: r.persona_id,
      review_text: r.review_text,
      scores: r.scores,
      strengths: r.strengths,
      weaknesses: r.weaknesses,
    })
  );

  return (
    <DiscussionFeed
      evaluationId={id}
      personas={personaInfos}
      initialCompletedReviews={initialReviews}
      initialStatus={evaluation.status}
      topicTitle={topicTitle}
      mode={evaluation.mode === "topic" ? "topic" : "product"}
      locale={locale}
    />
  );
}
