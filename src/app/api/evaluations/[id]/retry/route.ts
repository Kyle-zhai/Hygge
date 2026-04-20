import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchEffectivePlan } from "@/lib/billing/effective-plan";
import { fetchUserLLMOverrides } from "@/lib/llm/user-overrides";
import { enforceRateLimit } from "@/lib/rate-limit";
import { enqueueEvaluation } from "@/lib/queue/evaluations";

export const maxDuration = 15;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limitResponse = await enforceRateLimit("evaluations", user.id);
  if (limitResponse) return limitResponse;

  const { data: evaluation, error: evalError } = await supabase
    .from("evaluations")
    .select(
      `id, status, selected_persona_ids, mode,
       projects!inner (id, user_id, raw_input, url, attachments)`,
    )
    .eq("id", id)
    .single();

  if (evalError || !evaluation) {
    return NextResponse.json({ error: "Evaluation not found" }, { status: 404 });
  }

  const project = (evaluation as unknown as {
    projects: { id: string; user_id: string; raw_input: string; url: string | null; attachments: string[] };
  }).projects;

  if (project.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (evaluation.status !== "failed") {
    return NextResponse.json(
      { error: "Only failed evaluations can be retried" },
      { status: 409 },
    );
  }

  const effective = await fetchEffectivePlan(supabase, user.id);
  if (!effective) {
    return NextResponse.json({ error: "No subscription found" }, { status: 403 });
  }

  if (!effective.skipQuota && effective.evaluationsUsed >= effective.evaluationsLimit) {
    return NextResponse.json({ error: "Monthly evaluation limit reached" }, { status: 429 });
  }

  // Re-charge before re-enqueue to mirror the original POST flow. Worker
  // refunds on failure, so a failed retry will give the quota back.
  if (!effective.skipQuota) {
    const { error: chargeError } = await supabase
      .from("subscriptions")
      .update({ evaluations_used: effective.evaluationsUsed + 1 })
      .eq("user_id", user.id);
    if (chargeError) {
      return NextResponse.json({ error: chargeError.message }, { status: 500 });
    }
  }

  // Wipe any partial output from the previous run so the worker can reinsert
  // cleanly. summary_reports has a unique(evaluation_id) constraint that would
  // otherwise reject the retry's insert; persona_reviews has no constraint but
  // would accumulate duplicates in the DB.
  await supabase.from("persona_reviews").delete().eq("evaluation_id", id);
  await supabase.from("summary_reports").delete().eq("evaluation_id", id);

  // Reset state. Match the column set the worker sets on failure so the UI
  // sees a clean pending row instead of stale error text mid-retry.
  const { error: resetError } = await supabase
    .from("evaluations")
    .update({
      status: "pending",
      error_message: null,
      failed_at: null,
      completed_at: null,
    })
    .eq("id", id);

  if (resetError) {
    if (!effective.skipQuota) {
      await supabase
        .from("subscriptions")
        .update({ evaluations_used: effective.evaluationsUsed })
        .eq("user_id", user.id);
    }
    return NextResponse.json({ error: resetError.message }, { status: 500 });
  }

  const llmOverrides = await fetchUserLLMOverrides(user.id);

  try {
    await enqueueEvaluation({
      evaluationId: evaluation.id,
      projectId: project.id,
      rawInput: project.raw_input,
      url: project.url || undefined,
      attachments: project.attachments ?? [],
      selectedPersonaIds: evaluation.selected_persona_ids,
      planTier: effective.name,
      mode: evaluation.mode || "product",
      llmOverrides: llmOverrides ?? undefined,
    });
  } catch (queueError) {
    console.error("Retry enqueue failed, rolling back:", queueError);
    await supabase
      .from("evaluations")
      .update({ status: "failed", error_message: "Retry enqueue failed" })
      .eq("id", id);
    if (!effective.skipQuota) {
      await supabase
        .from("subscriptions")
        .update({ evaluations_used: effective.evaluationsUsed })
        .eq("user_id", user.id);
    }
    return NextResponse.json(
      { error: "Evaluation service temporarily unavailable. Please retry." },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: true, evaluationId: id });
}
