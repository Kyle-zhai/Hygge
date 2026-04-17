import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchEffectivePlan } from "@/lib/billing/effective-plan";
import { Queue } from "bullmq";
import IORedis from "ioredis";
import { fetchUserLLMOverrides } from "@/lib/llm/user-overrides";
import { enforceRateLimit } from "@/lib/rate-limit";

// Module-level singleton: reuse across requests (avoids cold-start per request)
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

  // Push job to queue (reuses module-level connection)
  try {
    const queue = getQueue();
    await queue.add("evaluate", {
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
    console.error("Failed to push to queue:", queueError);
  }

  return NextResponse.json({ project, evaluation }, { status: 201 });
}
