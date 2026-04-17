import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchEffectivePlan } from "@/lib/billing/effective-plan";
import { Queue } from "bullmq";
import IORedis from "ioredis";
import { fetchUserLLMOverrides } from "@/lib/llm/user-overrides";

let _queue: Queue | null = null;
function getQueue(): Queue {
  if (!_queue) {
    let redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
    if (redisUrl.includes("upstash.io") && redisUrl.startsWith("redis://")) {
      redisUrl = redisUrl.replace("redis://", "rediss://");
    }
    const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
    _queue = new Queue("evaluations", { connection });
  }
  return _queue;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { baseEvaluationId, rawInput, url, attachments } = body;

  if (!baseEvaluationId || !rawInput) {
    return NextResponse.json({ error: "baseEvaluationId and rawInput are required" }, { status: 400 });
  }

  const { data: baseEval } = await supabase
    .from("evaluations")
    .select("id, selected_persona_ids, mode, topic_classification, project_id")
    .eq("id", baseEvaluationId)
    .single();

  if (!baseEval) {
    return NextResponse.json({ error: "Base evaluation not found" }, { status: 404 });
  }

  const { data: baseProject } = await supabase
    .from("projects")
    .select("user_id")
    .eq("id", baseEval.project_id)
    .single();

  if (baseProject?.user_id !== user.id) {
    return NextResponse.json({ error: "Base evaluation does not belong to you" }, { status: 403 });
  }

  const effective = await fetchEffectivePlan(supabase, user.id);
  if (!effective) {
    return NextResponse.json({ error: "No subscription found" }, { status: 403 });
  }
  if (!effective.skipQuota && effective.evaluationsUsed >= effective.evaluationsLimit) {
    return NextResponse.json({ error: "Monthly evaluation limit reached" }, { status: 429 });
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({
      user_id: user.id,
      raw_input: rawInput,
      url: url || null,
      attachments: attachments || [],
      parsed_data: {},
    })
    .select()
    .single();

  if (projectError) {
    return NextResponse.json({ error: projectError.message }, { status: 500 });
  }

  const { data: evaluation, error: evalError } = await supabase
    .from("evaluations")
    .insert({
      project_id: project.id,
      selected_persona_ids: baseEval.selected_persona_ids,
      status: "pending",
      mode: baseEval.mode || "product",
      comparison_base_id: baseEvaluationId,
    })
    .select()
    .single();

  if (evalError) {
    return NextResponse.json({ error: evalError.message }, { status: 500 });
  }

  const llmOverrides = await fetchUserLLMOverrides(user.id);

  try {
    const queue = getQueue();
    await queue.add("evaluate", {
      evaluationId: evaluation.id,
      projectId: project.id,
      rawInput,
      url: url || undefined,
      attachments: attachments || [],
      selectedPersonaIds: baseEval.selected_persona_ids,
      planTier: effective.name,
      mode: baseEval.mode || "product",
      comparisonBaseId: baseEvaluationId,
      llmOverrides: llmOverrides ?? undefined,
    });
  } catch (queueError) {
    console.error("Failed to push compare job to queue:", queueError);
    await supabase.from("evaluations").delete().eq("id", evaluation.id);
    await supabase.from("projects").delete().eq("id", project.id);
    return NextResponse.json({ error: "Failed to enqueue evaluation" }, { status: 500 });
  }

  if (!effective.skipQuota) {
    await supabase
      .from("subscriptions")
      .update({ evaluations_used: effective.evaluationsUsed + 1 })
      .eq("user_id", user.id);
  }

  return NextResponse.json({ project, evaluation, baseEvaluationId }, { status: 201 });
}
