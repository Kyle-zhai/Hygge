import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchEffectivePlan } from "@/lib/billing/effective-plan";
import { fetchUserLLMOverrides } from "@/lib/llm/user-overrides";
import { enforceRateLimit } from "@/lib/rate-limit";
import { enqueueEvaluation } from "@/lib/queue/evaluations";

export const maxDuration = 15;

const MAX_RAW_INPUT_BYTES = 32 * 1024;

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: projects } = await supabase
    .from("projects")
    .select(`id, raw_input, parsed_data, url, created_at, evaluations (id, status, selected_persona_ids, created_at, completed_at)`)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return NextResponse.json({ projects });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limitResponse = await enforceRateLimit("evaluations", user.id);
  if (limitResponse) return limitResponse;

  const body = await request.json();
  const { rawInput, url, attachments, selectedPersonaIds, mode } = body;

  if (!rawInput || !selectedPersonaIds?.length) {
    return NextResponse.json({ error: "rawInput and selectedPersonaIds are required" }, { status: 400 });
  }

  const rawInputBytes = Buffer.byteLength(String(rawInput), "utf8");
  if (rawInputBytes > MAX_RAW_INPUT_BYTES) {
    return NextResponse.json(
      { error: `rawInput exceeds ${MAX_RAW_INPUT_BYTES} bytes (${rawInputBytes} received)` },
      { status: 413 },
    );
  }

  const effective = await fetchEffectivePlan(supabase, user.id);
  if (!effective) {
    return NextResponse.json({ error: "No subscription found" }, { status: 403 });
  }

  if (!effective.skipQuota && effective.evaluationsUsed >= effective.evaluationsLimit) {
    return NextResponse.json({ error: "Monthly evaluation limit reached" }, { status: 429 });
  }

  if (selectedPersonaIds.length > effective.maxPersonas) {
    return NextResponse.json(
      { error: `Maximum ${effective.maxPersonas} personas allowed on ${effective.name} plan` },
      { status: 400 },
    );
  }

  // Create project
  const { data: project, error: projectError } = await supabase
    .from("projects").insert({ user_id: user.id, raw_input: rawInput, url: url || null, attachments: attachments || [], parsed_data: {} }).select().single();

  if (projectError) {
    return NextResponse.json({ error: projectError.message }, { status: 500 });
  }

  // Create evaluation
  const { data: evaluation, error: evalError } = await supabase
    .from("evaluations").insert({ project_id: project.id, selected_persona_ids: selectedPersonaIds, status: "pending", mode: mode || "product" }).select().single();

  if (evalError) {
    return NextResponse.json({ error: evalError.message }, { status: 500 });
  }

  if (!effective.skipQuota) {
    await supabase
      .from("subscriptions")
      .update({ evaluations_used: effective.evaluationsUsed + 1 })
      .eq("user_id", user.id);
  }

  const llmOverrides = await fetchUserLLMOverrides(user.id);

  // Push job to queue (reuses module-level connection).
  // On failure: roll back evaluation + project + refund the quota we just consumed,
  // so Redis / queue outages never leave the user billed for a non-running job.
  try {
    await enqueueEvaluation({
      evaluationId: evaluation.id,
      projectId: project.id,
      rawInput,
      url: url || undefined,
      attachments: attachments || [],
      selectedPersonaIds,
      planTier: effective.name,
      mode: mode || "product",
      llmOverrides: llmOverrides ?? undefined,
    });
  } catch (queueError) {
    console.error("Failed to push to queue, rolling back:", queueError);
    await supabase.from("evaluations").delete().eq("id", evaluation.id);
    await supabase.from("projects").delete().eq("id", project.id);
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

  return NextResponse.json({ project, evaluation }, { status: 201 });
}
