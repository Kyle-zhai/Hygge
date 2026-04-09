import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

  const body = await request.json();
  const { rawInput, url, attachments, selectedPersonaIds } = body;

  if (!rawInput || !selectedPersonaIds?.length) {
    return NextResponse.json({ error: "rawInput and selectedPersonaIds are required" }, { status: 400 });
  }

  // Check subscription limits
  const { data: subscription } = await supabase
    .from("subscriptions").select("*").eq("user_id", user.id).single();

  if (!subscription) {
    return NextResponse.json({ error: "No subscription found" }, { status: 403 });
  }

  if (subscription.evaluations_used >= subscription.evaluations_limit) {
    return NextResponse.json({ error: "Monthly evaluation limit reached" }, { status: 429 });
  }

  const personaLimits = { free: 3, pro: 10, max: 20 };
  const maxPersonas = personaLimits[subscription.plan as keyof typeof personaLimits];
  if (selectedPersonaIds.length > maxPersonas) {
    return NextResponse.json({ error: `Maximum ${maxPersonas} personas allowed on ${subscription.plan} plan` }, { status: 400 });
  }

  // Create project
  const { data: project, error: projectError } = await supabase
    .from("projects").insert({ user_id: user.id, raw_input: rawInput, url: url || null, attachments: attachments || [], parsed_data: {} }).select().single();

  if (projectError) {
    return NextResponse.json({ error: projectError.message }, { status: 500 });
  }

  // Create evaluation
  const { data: evaluation, error: evalError } = await supabase
    .from("evaluations").insert({ project_id: project.id, selected_persona_ids: selectedPersonaIds, status: "pending" }).select().single();

  if (evalError) {
    return NextResponse.json({ error: evalError.message }, { status: 500 });
  }

  // Increment usage
  await supabase.from("subscriptions").update({ evaluations_used: subscription.evaluations_used + 1 }).eq("id", subscription.id);

  // Push job to queue
  try {
    const { Queue } = await import("bullmq");
    const IORedis = (await import("ioredis")).default;
    let redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
    if (redisUrl.includes("upstash.io") && redisUrl.startsWith("redis://")) {
      redisUrl = redisUrl.replace("redis://", "rediss://");
    }
    const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
    const queue = new Queue("evaluations", { connection });
    await queue.add("evaluate", {
      evaluationId: evaluation.id,
      projectId: project.id,
      rawInput,
      url: url || undefined,
      attachments: attachments || [],
      selectedPersonaIds,
      planTier: subscription.plan,
    });
    await connection.quit();
  } catch (queueError) {
    console.error("Failed to push to queue:", queueError);
  }

  return NextResponse.json({ project, evaluation }, { status: 201 });
}
