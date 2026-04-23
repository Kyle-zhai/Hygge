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
    .select(`id, status, mode, selected_persona_ids, error_message,
      persona_reviews (persona_id, review_text, scores, strengths, weaknesses),
      projects (parsed_data)`)
    .eq("id", id)
    .single();

  if (!evaluation) redirect(`/${locale}/evaluate/new`);

  if (evaluation.status === "completed") {
    redirect(`/${locale}/evaluate/${id}/result`);
  }

  type PersonaRow = {
    id: string;
    identity: { name: string; avatar?: string; locale_variants?: Record<string, { name?: string }> };
  };
  type ReviewRow = {
    persona_id: string;
    review_text: string;
    scores: unknown;
    strengths: string[];
    weaknesses: string[];
  };
  type EvaluationJoined = typeof evaluation & {
    projects?: { parsed_data?: { name?: string } } | null;
    persona_reviews?: ReviewRow[] | null;
  };
  const evalJoined = evaluation as EvaluationJoined;
  const topicTitle = evalJoined.projects?.parsed_data?.name || "Discussion";

  const existingReviews = evalJoined.persona_reviews ?? [];
  const allPersonaIds = Array.from(new Set([
    ...(evaluation.selected_persona_ids || []).map(String),
    ...existingReviews.map((r) => String(r.persona_id)),
  ]));
  const { data: personas } = allPersonaIds.length > 0
    ? await supabase.from("personas").select("id, identity").in("id", allPersonaIds)
    : { data: [] };

  const personaInfos = ((personas ?? []) as PersonaRow[]).map((p) => ({
    id: p.id,
    name: p.identity.locale_variants?.en?.name || p.identity.name,
    avatar: p.identity.avatar ?? "",
  }));

  const initialReviews = existingReviews.map((r) => ({
    persona_id: r.persona_id,
    review_text: r.review_text,
    scores: r.scores,
    strengths: r.strengths,
    weaknesses: r.weaknesses,
  }));

  return (
    <DiscussionFeed
      evaluationId={id}
      personas={personaInfos}
      initialCompletedReviews={initialReviews}
      initialStatus={evaluation.status}
      initialErrorMessage={(evaluation as { error_message?: string | null }).error_message ?? null}
      topicTitle={topicTitle}
      mode={evaluation.mode === "topic" ? "topic" : "product"}
      locale={locale}
    />
  );
}
